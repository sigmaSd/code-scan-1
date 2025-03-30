import { serveFile } from "jsr:@std/http@1/file-server";

Deno.serve((req) => {
  const url = req.url;
  const path = new URL(url).pathname;
  if (path === "/") {
    return serveFile(req, "src/index.html");
  }
  return serveFile(req, "src/" + path.slice(1)); // remove leading slash
});
