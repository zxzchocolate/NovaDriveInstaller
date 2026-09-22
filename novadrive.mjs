#!/usr/bin/env node

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

const execAsync = promisify(exec);

let puter;

const rl = createInterface({
    input,
    output,
    terminal: true
});

const green = text => `\x1b[92m${text}\x1b[0m`;
const dim = text => `\x1b[90m${text}\x1b[0m`;
const red = text => `\x1b[91m${text}\x1b[0m`;
const blue = text => `\x1b[94m${text}\x1b[0m`;

let cwd = ".";
let selected = null;
let history = [];

function shownPath() {
    if (cwd === ".") {
        return "~";
    }

    return "~/" + cwd.replace(/^\.?\//, "");
}

function prompt() {
    return (
        green("nova@novadrive") +
        dim(":") +
        shownPath() +
        dim("$ ")
    );
}

function normalizePath(path) {

    if (!path || path === ".") {
        return ".";
    }

    if (path === "~") {
        return ".";
    }

    if (path === "..") {

        if (cwd === ".") {
            return ".";
        }

        const parts = cwd.split("/");

        parts.pop();

        return parts.length
            ? parts.join("/")
            : ".";
    }

    if (path.startsWith("./")) {
        return path;
    }

    if (cwd === ".") {
        return path;
    }

    return cwd + "/" + path;
}

function itemName(item) {
    return item.name || item.filename || "unknown";
}

function itemPath(item) {
    return item.path || item.fullPath || itemName(item);
}

function isDirectory(item) {
    return (
        item.is_dir === true ||
        item.isDirectory === true ||
        item.type === "directory"
    );
}

function formatSize(value) {

    let size = Number(value || 0);

    if (!size) {
        return "-";
    }

    const units = [
        "B",
        "KB",
        "MB",
        "GB",
        "TB"
    ];

    let index = 0;

    while (
        size >= 1024 &&
        index < units.length - 1
    ) {
        size /= 1024;
        index++;
    }

    return (
        size.toFixed(size >= 10 ? 0 : 1) +
        " " +
        units[index]
    );
}

async function authenticate() {

    const sdk = await import(
        "@heyputer/puter.js/src/init.cjs"
    );

    const getAuthToken = sdk.getAuthToken;

    console.log(dim("Opening Puter login..."));
    console.log("");

    const token = await getAuthToken();

    puter = sdk.init(token);

    console.log(
        green("Puter authentication successful.")
    );

    console.log("");
}

async function ls() {

    const files = await puter.fs.readdir(cwd);

    if (!files.length) {
        console.log(dim("empty directory"));
        return;
    }

    for (const file of files) {

        const prefix =
            isDirectory(file)
                ? blue("[DIR] ")
                : "      ";

        console.log(
            prefix +
            itemName(file) +
            "    " +
            formatSize(file.size)
        );
    }
}

async function cd(path) {

    if (!path) {
        cwd = ".";
        return;
    }

    const target = normalizePath(path);

    if (target === "..") {
        cwd = normalizePath("..");
        return;
    }

    try {

        const item = await puter.fs.stat(target);

        if (!isDirectory(item)) {
            console.log(
                red("not a directory: " + path)
            );
            return;
        }

        cwd = target;

    } catch (error) {

        console.log(
            red("directory not found: " + path)
        );
    }
}

async function mkdir(name) {

    if (!name) {

        console.log(
            red("usage: mkdir <name>")
        );

        return;
    }

    const target = normalizePath(name);

    await puter.fs.mkdir(target);

    console.log(
        green("created: ") + target
    );
}

async function remove(path) {

    if (!path) {

        if (!selected) {

            console.log(
                red("usage: rm <file>")
            );

            return;
        }

        path = selected;
    }

    const target = normalizePath(path);

    await puter.fs.delete(target);

    selected = null;

    console.log(
        green("removed: ") + target
    );
}

async function rename(oldName, newName) {

    if (!oldName || !newName) {

        console.log(
            red("usage: rename <old> <new>")
        );

        return;
    }

    const target = normalizePath(oldName);

    await puter.fs.rename(
        target,
        newName
    );

    console.log(
        green("renamed: ") +
        oldName +
        " -> " +
        newName
    );
}

async function openFile(path) {

    if (!path) {

        console.log(
            red("usage: open <file>")
        );

        return;
    }

    const target = normalizePath(path);

    try {

        const url =
            await puter.fs.getReadURL(target);

        console.log("");
        console.log(url);
        console.log("");

        if (process.platform === "darwin") {

            await execAsync(
                `open "${url}"`
            );

        } else if (process.platform === "win32") {

            await execAsync(
                `start "" "${url}"`
            );

        } else {

            await execAsync(
                `xdg-open "${url}"`
            );
        }

    } catch (error) {

        console.log(
            red(
                error.message ||
                "unable to open file"
            )
        );
    }
}

async function share(path) {

    if (!path) {

        console.log(
            red("usage: share <file>")
        );

        return;
    }

    const target = normalizePath(path);

    try {

        const link =
            await puter.fs.getShareLink(target);

        console.log("");
        console.log(green(link));
        console.log("");

    } catch (error) {

        console.log(
            red(
                error.message ||
                "unable to create share link"
            )
        );
    }
}

async function upload(localPath) {

    if (!localPath) {

        console.log(
            red("usage: upload <local-file>")
        );

        return;
    }

    try {

        const data =
            await readFile(localPath);

        const name =
            basename(localPath);

        const destination =
            cwd === "."
                ? name
                : cwd + "/" + name;

        await puter.fs.write(
            destination,
            data,
            {
                dedupeName: true
            }
        );

        console.log(
            green("uploaded: ") + name
        );

    } catch (error) {

        console.log(
            red(
                error.message ||
                "upload failed"
            )
        );
    }
}

function help() {

    console.log("ls                  list files");
    console.log("cd <dir>             enter directory");
    console.log("cd ..                go back");
    console.log("pwd                  show path");
    console.log("open <file>          open file");
    console.log("upload <file>        upload local file");
    console.log("mkdir <name>         create directory");
    console.log("rename <old> <new>   rename");
    console.log("rm <file>            delete");
    console.log("share <file>         create share link");
    console.log("clear                clear terminal");
    console.log("newtab               open terminal tab");
    console.log("help                 show commands");
    console.log("exit                 quit");
}

async function command(line) {

    const inputLine = line.trim();

    if (!inputLine) {
        return;
    }

    history.push(inputLine);

    const parts =
        inputLine.split(/\s+/);

    const cmd =
        parts.shift().toLowerCase();

    if (cmd === "help") {
        help();
        return;
    }

    if (cmd === "ls") {
        await ls();
        return;
    }

    if (cmd === "pwd") {

        console.log(
            cwd === "."
                ? "/"
                : "/" + cwd
        );

        return;
    }

    if (cmd === "cd") {

        await cd(parts.join(" "));
        return;
    }

    if (cmd === "mkdir") {

        await mkdir(parts.join(" "));
        return;
    }

    if (cmd === "rm") {

        await remove(parts.join(" "));
        return;
    }

    if (cmd === "rename") {

        if (parts.length < 2) {

            console.log(
                red("usage: rename <old> <new>")
            );

            return;
        }

        const oldName = parts.shift();

        await rename(
            oldName,
            parts.join(" ")
        );

        return;
    }

    if (cmd === "open") {

        await openFile(
            parts.join(" ")
        );

        return;
    }

    if (cmd === "share") {

        await share(
            parts.join(" ")
        );

        return;
    }

    if (cmd === "upload") {

        await upload(
            parts.join(" ")
        );

        return;
    }

    if (cmd === "clear") {

        console.clear();
        return;
    }

    if (cmd === "newtab") {

        console.log(
            dim("Use Ctrl+Shift+T for another shell tab.")
        );

        return;
    }

    if (cmd === "exit") {

        process.exit(0);
    }

    console.log(
        red("command not found: " + cmd)
    );
}

async function main() {

    console.clear();

    console.log(
        green("NovaDrive")
    );

    console.log(
        dim("Terminal cloud drive")
    );

    console.log("");

    try {

        await authenticate();

    } catch (error) {

        console.log(
            red(
                "Authentication failed: " +
                (error.message || error)
            )
        );

        process.exit(1);
    }

    console.log(
        dim("Type help for commands.")
    );

    console.log("");

    while (true) {

        try {

            const line =
                await rl.question(prompt());

            await command(line);

        } catch (error) {

            console.log(
                red(
                    error.message ||
                    "command failed"
                )
            );
        }
    }
}

main();
