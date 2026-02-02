namespace Prog3_WebApi_Javascript.DTOs
{
    public class GeneratedQuestion
    {
        public string questionType { get; set; } // mcq/open
        public string title { get; set; }
        public string code { get; set; }
        public string questionText { get; set; }

        public List<string>? options { get; set; }
        public int? correctIndex { get; set; }

        public string? openAnswerExample { get; set; }
        public List<string>? expectedKeyPoints { get; set; }

        public string explanation { get; set; }
    }
}