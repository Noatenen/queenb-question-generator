using Microsoft.AspNetCore.Http;

namespace Prog3_WebApi_Javascript.DTOs
{
    public class FileUploadRequest
    {
        public IFormFile File { get; set; }
    }
}