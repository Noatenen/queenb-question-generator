namespace Prog3_WebApi_Javascript.DTOs
{
    public class QuestionPrompt
    {
        public string Domain { get; set; }       // JavaScript / HTML / CSS
        public string Concept { get; set; }      // objects / functions / events / etc.
        public string QuestionType { get; set; } // mcq / open
        public string Level { get; set; }        // basic

        public string? FileId { get; set; }               // מזהה הקובץ מה-API
        public string? PreviousResponseID { get; set; }   // לשמירת הקשר השיחה
    }
}