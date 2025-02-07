export default {
  async fetch(request) {
    const url = new URL(request.url);
    const username = url.pathname.split("/")[1]?.toLowerCase() || "";
    const path = url.pathname.split("/").slice(2).join("/").toLowerCase() || "";
    
    if (!username) {
      return new Response("Missing username", { status: 400 });
    }

    const githubUrl = `https://raw.githubusercontent.com/${username}/insat/main/endsat.txt`;

    try {
      const response = await fetch(githubUrl);
      if (!response.ok) {
        return new Response("GitHub file not found", { status: 404 });
      }

      const text = await response.text();
      const lines = text.split("\n").map(line => line.trim()).filter(line => line);
      let redirectUrl = null;

      for (const line of lines) {
        const parts = line.split(/\s+/); // Split on spaces
        const key = parts[0].toLowerCase();
        let value = parts[1] || key; // Default to first entry if no URL is given

        if (!value.startsWith("http://") && !value.startsWith("https://")) {
          if (value.startsWith("www.")) {
            value = `http://${value}`;
          } else {
            value = `http://${value}`;
          }
        }

        if (path === "" && redirectUrl === null) {
          redirectUrl = value; // Default redirect if no path is given
        } else if (key === path) {
          redirectUrl = value;
          break;
        }
      }

      if (redirectUrl) {
        return Response.redirect(redirectUrl, 307);
      } else {
        return new Response("Not found", { status: 404 });
      }
    } catch (error) {
      return new Response("Error fetching GitHub file", { status: 500 });
    }
  }
};
