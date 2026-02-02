using Microsoft.AspNetCore.Mvc;
using Prog3_WebApi_Javascript.DTOs;
using System.Text.Json.Nodes;

namespace Prog3_WebApi_Javascript.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class GPTController : ControllerBase
    {
        private readonly HttpClient _client;

        public GPTController(IConfiguration config)
        {
            _client = new HttpClient();

            string apiKey = config.GetValue<string>("OpenAI:Key");
            string auth = "Bearer " + apiKey;
            _client.DefaultRequestHeaders.Add("Authorization", auth);
        }

        // =========================================================
        // DALLE
        // =========================================================
        [HttpPost("Dalle")]
        public async Task<IActionResult> Dalle(ImagePrompt imagePrompt)
        {
            if (imagePrompt == null || string.IsNullOrWhiteSpace(imagePrompt.Prompt))
                return BadRequest("Prompt is empty.");

            // DALL·E עובד לרוב טוב יותר עם פרומפט באנגלית
// DALL·E עובד לרוב טוב יותר עם פרומפט באנגלית
            string promptToSend =
                "Flat vector illustration, clean modern UI style, pastel pink background, purple accents, " +
                "teen girl programmer with laptop, friendly educational vibe, simple clean shapes, " +
                "no text, no letters, no logos, no watermark, high quality, consistent style. " +
                "Scene hint: " + imagePrompt.Prompt;


            string model = "dall-e-2";
            string size = "256x256";

            DalleRequest request = new DalleRequest()
            {
                prompt = promptToSend,
                model = model,
                size = size
            };

            string endpoint = "https://api.openai.com/v1/images/generations";
            var res = await _client.PostAsJsonAsync(endpoint, request);

            if (!res.IsSuccessStatusCode)
            {
                var err = await res.Content.ReadAsStringAsync();
                return BadRequest("problem: " + err);
            }

            JsonObject? jsonFromDalle = await res.Content.ReadFromJsonAsync<JsonObject>();
            if (jsonFromDalle == null)
                return BadRequest("empty");

            string url = jsonFromDalle["data"]?[0]?["url"]?.ToString() ?? "";
            if (string.IsNullOrWhiteSpace(url))
                return BadRequest("No image url returned.");

            return Ok(url);
        }

        // =========================================================
        // GPT – Generate QueenB style question
        // =========================================================
        [HttpPost("GPTChat")]
        public async Task<IActionResult> GPTChat(QuestionPrompt questionPromptFromUser)
        {
            if (questionPromptFromUser == null)
                return BadRequest("Request is null.");

            // בדיקות בסיסיות כדי לא לקבל nulls
            if (string.IsNullOrWhiteSpace(questionPromptFromUser.Domain) ||
                string.IsNullOrWhiteSpace(questionPromptFromUser.Concept) ||
                string.IsNullOrWhiteSpace(questionPromptFromUser.QuestionType) ||
                string.IsNullOrWhiteSpace(questionPromptFromUser.Level))
            {
                return BadRequest("Missing fields in QuestionPrompt.");
            }

            string endpoint = "https://api.openai.com/v1/chat/completions";
            string model = "gpt-3.5-turbo";

            int max_tokens = 450;
            double tmpr = 0.7;

            // System – נועל עברית לשדות טקסט, ורק code באנגלית
            string systemMsg =
                "את/ה מדריכת QueenB שמנסחת שאלות קצרות לבנות כיתה ח׳–ט׳.\n" +
                "הממשק בעברית.\n" +
                "חובה: כל הטקסטים בעברית בלבד.\n" +
                "חריג יחיד: השדה code חייב להיות באנגלית בלבד (מילות מפתח ושמות משתנים).\n" +
                "הכי חשוב: זו שאלת תוצאה.\n" +
                "כלומר: נותנים קוד ואז שואלים מה יודפס/מה תהיה התוצאה, והאפשרויות הן תוצאות קצרות.\n" +
                "אסור לכתוב הסברים ארוכים בשאלה עצמה.\n" +
                "להחזיר JSON בלבד, בלי שום טקסט מסביב.";



            // User – בקשה מפורטת עם פורמט JSON
            string userPrompt =
                "צרי שאלה אחת בסגנון QueenB.\n" +
                $"תחום: {questionPromptFromUser.Domain}\n" +
                $"מושג: {questionPromptFromUser.Concept}\n" +
                $"סוג שאלה: {questionPromptFromUser.QuestionType} (mcq/open)\n" +
                $"רמה: {questionPromptFromUser.Level}\n\n" +

                "כללים:\n" +
                "1) השאלה חייבת להיות מסוג 'מה תהיה התוצאה?' / 'מה יודפס?' / 'מה יחזור מהפונקציה?'.\n" +
                "2) code: עד 10 שורות, באנגלית בלבד.\n" +
                "3) questionText: משפט אחד קצר בעברית.\n" +
                "4) אם mcq: בדיוק 3 תשובות קצרות שהן תוצאה (למשל: 291, undefined, 'Hello', שגיאה).\n" +
                "   לא לכתוב תשובות כמו 'יקפיץ הודעה' – רק תוצאה ממשית.\n" +
                "5) correctIndex: 0/1/2.\n" +
                "6) explanation: 1–2 משפטים בעברית שמסבירים למה.\n" +
                "7) להחזיר JSON בלבד בפורמט:\n" +
                "{\n" +
                "  \"questionType\": \"mcq\" או \"open\",\n" +
                "  \"title\": \"כותרת קצרה בעברית\",\n" +
                "  \"code\": \"...\",\n" +
                "  \"questionText\": \"...\",\n" +
                "  \"options\": [\"...\",\"...\",\"...\"] או null,\n" +
                "  \"correctIndex\": 0/1/2 או null,\n" +
                "  \"openAnswerExample\": \"...\" או null,\n" +
                "  \"expectedKeyPoints\": [\"...\", \"...\"] או null,\n" +
                "  \"explanation\": \"...\"\n" +
                "}";


            GPTRequest request = new GPTRequest()
            {
                max_tokens = max_tokens,
                model = model,
                response_format = new { type = "json_object" },
                temperature = tmpr,
                messages = new List<Message>()
                {
                    new Message
                    {
                        role = "system",
                        content = systemMsg
                    },
                    new Message
                    {
                        role = "user",
                        content = userPrompt
                    }
                }
            };

            var res = await _client.PostAsJsonAsync(endpoint, request);

            if (!res.IsSuccessStatusCode)
            {
                var err = await res.Content.ReadAsStringAsync();
                return BadRequest("problem: " + err);
            }

            JsonObject? jsonFromGPT = await res.Content.ReadFromJsonAsync<JsonObject>();
            if (jsonFromGPT == null)
                return BadRequest("empty");

            string content = jsonFromGPT["choices"]?[0]?["message"]?["content"]?.ToString() ?? "";
            if (string.IsNullOrWhiteSpace(content))
                return BadRequest("No content returned.");

            // מחזירים JSON אמיתי כדי ש-Swagger יציג יפה
            JsonNode? parsed = JsonNode.Parse(content);
            if (parsed == null)
                return BadRequest("Model returned invalid JSON.");

            return Ok(parsed);
        }
    }
}
