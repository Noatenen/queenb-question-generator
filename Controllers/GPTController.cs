using Microsoft.AspNetCore.Mvc;
using Prog3_WebApi_Javascript.DTOs;
using System.Net.Http.Headers;
using System.Text.Json.Nodes;

namespace Prog3_WebApi_Javascript.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class GPTController : ControllerBase
    {
        private readonly HttpClient _client;
        private readonly IConfiguration _config;
        private readonly string _model = "gpt-4o";

        public GPTController(IConfiguration config)
        {
            _config = config;

            _client = new HttpClient();
            string apiKey = _config.GetValue<string>("OpenAI:Key") ?? "";
            _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        }

        // ===============================
        // 1) Generate question from PDF
        // ===============================
        [HttpPost("GPTChatFromPdf")]
        public async Task<IActionResult> GPTChatFromPdf(QuestionPrompt promptFromUser)
        {
            // 1. שליפת IDs מהקונפיגורציה
            string juniorId = _config.GetValue<string>("OpenAI:JuniorPdfId") ?? "";
            string seniorId = _config.GetValue<string>("OpenAI:SeniorPdfId") ?? "";

            string fileIdToUse = (promptFromUser.Level == "senior") ? seniorId : juniorId;

            if (string.IsNullOrWhiteSpace(fileIdToUse))
                return BadRequest("FileId is missing in appsettings.json.");

            string endpoint = "https://api.openai.com/v1/responses";

            string systemMsg =
                "את/ה מדריכת QueenB שמנסחת שאלות קצרות לבנות כיתה ח׳–ט׳. " +
                "הממשק בעברית. חובה: כל הטקסטים בעברית בלבד. חריג יחיד: השדה code באנגלית. " +
                "המטרה: שאלה קצרה מסוג 'מה תהיה התוצאה?'. " +
                "אסור להמציא חומר שלא מופיע ב-PDF. " +
                "החזירי JSON בלבד, ללא Markdown וללא טקסט נוסף. " +
                "הקפידי על המפתחות הבאים בדיוק: questionType, title, code, questionText, options, correctIndex, openAnswerExample, expectedKeyPoints, explanation." +
                "Return ONLY valid json.";

            string userPrompt =
                $"צרי שאלה אחת בסגנון QueenB בתחום {promptFromUser.Domain}, מושג {promptFromUser.Concept}, " +
                $"סוג {promptFromUser.QuestionType}, רמה {promptFromUser.Level}. " +
                "חוקים: קוד באנגלית (עד 10 שורות). " +
                "אם questionType הוא mcq חובה להחזיר options (3 אפשרויות) ו-correctIndex. " +
                "אם questionType הוא open אפשר להחזיר openAnswerExample ו-expectedKeyPoints."+
                "Return the answer as valid json only.";


            // 2. בקשה ל-Responses API
            var requestBody = new Dictionary<string, object?>
            {
                ["model"] = _model,
                ["max_output_tokens"] = 800,
                ["temperature"] = 0.7,
                ["instructions"] = systemMsg,

                // הכי חשוב: כופה JSON תקין
                ["text"] = new
                {
                    format = new { type = "json_object" }
                },

                ["input"] = new object[]
                {
                    new {
                        role = "user",
                        content = new object[]
                        {
                            new { type = "input_file", file_id = fileIdToUse },
                            new { type = "input_text", text = userPrompt }
                        }
                    }
                }
            };

            if (!string.IsNullOrWhiteSpace(promptFromUser.PreviousResponseID))
                requestBody["previous_response_id"] = promptFromUser.PreviousResponseID;

            var res = await _client.PostAsJsonAsync(endpoint, requestBody);

            var raw = await res.Content.ReadAsStringAsync();
            if (!res.IsSuccessStatusCode)
            {
                // מחזירים את ההודעה המדויקת כדי שתראי מה OpenAI מחזיר
                return BadRequest(raw);
            }

            // 3. חילוץ output_text
            var root = JsonNode.Parse(raw) as JsonObject;

            string responseId = root?["id"]?.GetValue<string>();
            string outputText = null;

            var outputArray = root?["output"] as JsonArray;
            if (outputArray != null)
            {
                foreach (var outItem in outputArray)
                {
                    var contentArray = outItem?["content"] as JsonArray;
                    if (contentArray == null) continue;

                    foreach (var c in contentArray)
                    {
                        if (c?["type"]?.GetValue<string>() == "output_text")
                        {
                            outputText = c?["text"]?.GetValue<string>();
                            break;
                        }
                    }

                    if (outputText != null) break;
                }
            }

            if (!string.IsNullOrWhiteSpace(outputText))
                outputText = outputText.Replace("```json", "").Replace("```", "").Trim();

            return Ok(new { text = outputText, responseID = responseId });
        }

        // ===============================
        // 2) Upload PDF (Swagger only / backstage)
        // ===============================
        [HttpPost("UploadPdf")]
        public async Task<IActionResult> UploadPdf([FromForm] FileUploadRequest req)
        {
            // אופציונלי: הגנה עם מפתח (מומלץ אם את לא רוצה שאחרים יוכלו להעלות)
            // הוסיפי ב-appsettings: "AdminUploadKey": "SOME_SECRET"
            string adminKey = _config.GetValue<string>("AdminUploadKey") ?? "";
            if (!string.IsNullOrWhiteSpace(adminKey))
            {
                if (!Request.Headers.TryGetValue("X-ADMIN-KEY", out var sentKey) || sentKey != adminKey)
                    return Unauthorized("Not allowed.");
            }

            if (req?.File == null || req.File.Length == 0)
                return BadRequest("No file.");

            var ext = Path.GetExtension(req.File.FileName).ToLowerInvariant();
            if (ext != ".pdf")
                return BadRequest("File must be a PDF.");

            using var form = new MultipartFormDataContent();
            form.Add(new StringContent("user_data"), "purpose");

            using var fileStream = req.File.OpenReadStream();
            using var fileContent = new StreamContent(fileStream);
            fileContent.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");

            form.Add(fileContent, "file", req.File.FileName);

            var response = await _client.PostAsync("https://api.openai.com/v1/files", form);

            var raw = await response.Content.ReadAsStringAsync();
            if (!response.IsSuccessStatusCode)
                return BadRequest(raw);

            var json = JsonNode.Parse(raw) as JsonObject;
            var fileId = json?["id"]?.ToString();

            return Ok(fileId);
        }

        // ===============================
        // 3) DALL·E image
        // ===============================
        [HttpPost("Dalle")]
        public async Task<IActionResult> Dalle(ImagePrompt imagePrompt)
        {
            if (imagePrompt == null || string.IsNullOrWhiteSpace(imagePrompt.Prompt))
                return BadRequest("Empty prompt.");

            var request = new
            {
                model = "dall-e-2",
                prompt = "Flat vector illustration, teen girl programmer, " + imagePrompt.Prompt,
                size = "256x256"
            };

            var res = await _client.PostAsJsonAsync("https://api.openai.com/v1/images/generations", request);

            var raw = await res.Content.ReadAsStringAsync();
            if (!res.IsSuccessStatusCode)
                return BadRequest(raw);

            var json = JsonNode.Parse(raw) as JsonObject;
            var url = json?["data"]?[0]?["url"]?.ToString();

            // מחזיר מחרוזת נקייה (בלי מרכאות כפולות)
            return Ok(url);
        }
    }
}
