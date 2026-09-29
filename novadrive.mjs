import http from "node:http";
import os from "node:os";
import { exec } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const PORT = 45176;

let puter = null;
let cwd = ".";

const rl = createInterface({
  input,
  output,
  terminal: true
});

function getLocalIP() {
  const interfaces = os.networkInterfaces();

  for (const name of Object.keys(interfaces)) {
    for (const info of interfaces[name] || []) {
      if (
        info.family === "IPv4" &&
        !info.internal &&
        !info.address.startsWith("127.")
      ) {
        return info.address;
      }
    }
  }

  return "127.0.0.1";
}

function openBrowser(url) {
  const platform = process.platform;

  if (platform === "win32") {
    exec(`start "" "${url}"`);
  } else if (platform === "darwin") {
    exec(`open "${url}"`);
  } else {
    exec(`xdg-open "${url}"`);
  }
}

async function authenticate() {
  const ip = getLocalIP();
  const redirectURL = `http://${ip}:${PORT}`;

  console.log("");
  console.log("NovaDrive authentication");
  console.log("");
  console.log(`Local IP: ${ip}`);
  console.log(`Callback: ${redirectURL}`);
  console.log("");
  console.log("Opening Puter login...");
  console.log("");

  const token = await new Promise((resolve, reject) => {
    let finished = false;

    const server = http.createServer((req, res) => {
      if (!req.url) return;

      const url = new URL(req.url, redirectURL);

      console.log(`Callback received: ${url.pathname}`);

      const token =
        url.searchParams.get("token") ||
        url.searchParams.get("auth_token") ||
        url.searchParams.get("authToken");

      if (token) {
        finished = true;

        res.writeHead(200, {
          "Content-Type": "text/html"
        });

        res.end(`
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>NovaDrive</title>
</head>
<body style="background:#111;color:#eee;font-family:monospace;padding:40px">
<h2>NovaDrive authentication successful.</h2>
<p>You can return to the terminal.</p>
</body>
</html>
`);

        server.close();

        resolve(token);
        return;
      }

      res.writeHead(200, {
        "Content-Type": "text/html"
      });

      res.end(`
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>NovaDrive</title>
</head>
<body style="background:#111;color:#eee;font-family:monospace;padding:40px">
<h2>NovaDrive</h2>
<p>Authentication callback received.</p>
<p>You can return to the terminal.</p>
</body>
</html>
`);
    });

    server.on("error", reject);

    server.listen(PORT, "0.0.0.0", () => {
      const loginURL =
        `https://puter.com/?action=authme&redirectURL=` +
        encodeURIComponent(redirectURL);

      console.log(`Listening on ${redirectURL}`);
      console.log("");

      openBrowser(loginURL);
    });

    setTimeout(() => {
      if (!finished) {
        server.close();
        reject(new Error("Authentication timed out."));
      }
    }, 5 * 60 * 1000);
  });

  const { init } = await import("@heyputer/puter.js/src/init.cjs");

  puter = init(token);

  console.log("");
  console.log("Authentication successful.");
  console.log("");
}

function resolvePath(path) {
  if (!path || path === ".") return cwd;

  if (path === "..") {
    if (cwd === ".") return ".";
    const parts = cwd.split("/").filter(Boolean);
    parts.pop();
    return parts.length ? parts.join("/") : ".";
  }

  if (path.startsWith("/")) {
    return path.replace(/^\/+/, "") || ".";
  }

  if (cwd === ".") {
    return path;
  }

  return `${cwd}/${path}`;
}

function displayPath() {
  return cwd === "." ? "~" : `~/${cwd}`;
}

async function commandLs() {
  const files = await puter.fs.readdir(cwd);

  if (!files.length) {
    console.log("empty");
    return;
  }

  for (const file of files) {
    const name = file.name || file.path || "unknown";

    if (file.is_dir || file.type === "directory") {
      console.log(`${name}/`);
    } else {
      console.log(name);
    }
  }
}

async function commandCd(path) {
  const target = resolvePath(path || ".");

  if (target === ".") {
    cwd = ".";
    return;
  }

  const stat = await puter.fs.stat(target);

  if (!stat.is_dir && stat.type !== "directory") {
    throw new Error("not a directory");
  }

  cwd = target;
}

async function commandMkdir(name) {
  if (!name) {
    throw new Error("usage: mkdir <name>");
  }

  await puter.fs.mkdir(resolvePath(name));
}

async function commandRm(name) {
  if (!name) {
    throw new Error("usage: rm <file>");
  }

  await puter.fs.delete(resolvePath(name));
}

async function commandRename(oldName, newName) {
  if (!oldName || !newName) {
    throw new Error("usage: rename <old> <new>");
  }

  await puter.fs.rename(
    resolvePath(oldName),
    resolvePath(newName)
  );
}

async function commandOpen(name) {
  if (!name) {
    throw new Error("usage: open <file>");
  }

  const path = resolvePath(name);
  const url = await puter.fs.getReadURL(path);

  console.log(url);

  openBrowser(url);
}

async function commandShare(name) {
  if (!name) {
    throw new Error("usage: share <file>");
  }

  const path = resolvePath(name);

  if (typeof puter.fs.getShareLink === "function") {
    const link = await puter.fs.getShareLink(path);
    console.log(link);
    return;
  }

  const url = await puter.fs.getReadURL(path);
  console.log(url);
}

async function commandUpload(localPath) {
  if (!localPath) {
    throw new Error("usage: upload <local-file>");
  }

  const fs = await import("node:fs");

  if (!fs.existsSync(localPath)) {
    throw new Error("local file not found");
  }

  const fileName = localPath.split(/[\\/]/).pop();
  const destination =
    cwd === "."
      ? fileName
      : `${cwd}/${fileName}`;

  const data = fs.readFileSync(localPath);

  await puter.fs.write(
    destination,
    data,
    {
      dedupeName: true
    }
  );

  console.log(`uploaded ${fileName}`);
}

function commandHelp() {
  console.log(`
NovaDrive commands

ls
cd <directory>
cd ..
pwd
mkdir <directory>
rename <old> <new>
rm <file>
open <file>
share <file>
upload <local-file>
clear
help
exit
`);
}

function commandClear() {
  process.stdout.write("\x1b[2J\x1b[H");
}

async function runCommand(line) {
  const parts = line.trim().split(/\s+/);

  const command = parts.shift();

  if (!command) return;

  switch (command) {
    case "ls":
      await commandLs();
      break;

    case "cd":
      await commandCd(parts[0]);
      break;

    case "pwd":
      console.log(cwd);
      break;

    case "mkdir":
      await commandMkdir(parts[0]);
      break;

    case "rename":
      await commandRename(parts[0], parts[1]);
      break;

    case "rm":
      await commandRm(parts[0]);
      break;

    case "open":
      await commandOpen(parts[0]);
      break;

    case "share":
      await commandShare(parts[0]);
      break;

    case "upload":
      await commandUpload(parts.join(" "));
      break;

    case "clear":
      commandClear();
      break;

    case "help":
      commandHelp();
      break;

    case "exit":
      rl.close();
      process.exit(0);

    default:
      console.log(`command not found: ${command}`);
  }
}

async function main() {
  commandClear();

  console.log("\x1b[1mNovaDrive\x1b[0m");
  console.log("Puter cloud terminal");
  console.log("");

  await authenticate();

  console.log("");
  console.log("Type 'help' for commands.");
  console.log("");

  while (true) {
    try {
      const line = await rl.question(
        `\x1b[36mnovadrive:${displayPath()}$\x1b[0m `
      );

      await runCommand(line);
    } catch (error) {
      console.log(
        `error: ${error?.message || error}`
      );
    }
  }
}

main().catch(error => {
  console.error(
    `NovaDrive failed: ${error?.message || error}`
  );

  process.exit(1);
});
