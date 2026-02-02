namespace Prog3_WebApi_Javascript.DTOs
{
    public class GPTRequest
    {
        public string model { get; set; }
        public List<Message> messages { get; set; } = new List<Message>();
        public int max_tokens { get; set; }
        public object response_format { get; set; }
        public double temperature { get; set; }


    }

}