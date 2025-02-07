export default {
  async fetch(request) {
    const url = new URL(request.url);
    console.log("Full URL:", url.href);

    const pathSegments = url.pathname.split("/").filter(Boolean);
    console.log("Path segments:", pathSegments);

    if (pathSegments.length < 1) {
      console.log("No username found in URL path");
      return new Response("Missing username", { status: 400 });
    }

    const username = pathSegments[0].toLowerCase();
    console.log("Extracted username:", username);

    const subPath = pathSegments.slice(1).join("/").toLowerCase();
    console.log("Extracted sub-path:", subPath);

    const githubUrl = `https://raw.githubusercontent.com/${username}/endsat/main/endsat.txt`;
    console.log("Fetching from GitHub URL:", githubUrl);

    try {
      const response = await fetch(githubUrl, { headers: { "User-Agent": "CloudflareWorker" } });

      if (!response.ok) {
        console.log("GitHub file not found. Status:", response.status);
        return new Response("GitHub file not found", { status: 404 });
      }

      const text = await response.text();
      console.log("Fetched file content:", text);

      const lines = text.split("\n").map(line => line.trim()).filter(line => line);
      console.log("Processed file lines:", lines);

      let defaultRedirect = null;
      let redirectUrl = null;

      for (const line of lines) {
        console.log("Processing line:", line);
        const parts = line.split(/\s+/); // Splitting by spaces (handling multiple spaces)
        if (parts.length < 1) continue;

        const key = parts[0].toLowerCase();
        const value = parts.slice(1).join(" "); // Join remaining parts as URL

        let urlValue = value || key; // Use key as URL if no value is provided

        if (!urlValue.startsWith("http")) {
          urlValue = `http://${urlValue}`;
        }

        console.log(`Key: ${key}, URL: ${urlValue}`);

        if (defaultRedirect === null) {
          defaultRedirect = urlValue; // First link is the default
        }

        if (subPath === "") {
          redirectUrl = defaultRedirect;
        } else if (key === subPath) {
          redirectUrl = urlValue;
          break;
        }
      }

      console.log("Final redirect URL:", redirectUrl);

      return redirectUrl
        ? Response.redirect(redirectUrl, 307)
        : new Response("Not found", { status: 404 });

    } catch (error) {
      console.error("Error fetching GitHub file:", error);
      return new Response("Error fetching GitHub file", { status: 500 });
    }
  }
};
