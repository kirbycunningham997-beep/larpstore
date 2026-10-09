// quiet.js — suppress only the Node "ExperimentalWarning" for the built-in
// SQLite module, so the console stays clean. All other warnings pass through.
// Imported first in server.js, before node:sqlite is ever touched.

const originalEmit = process.emit;
process.emit = function (name, data, ...rest) {
  if (
    name === "warning" &&
    data &&
    data.name === "ExperimentalWarning" &&
    typeof data.message === "string" &&
    data.message.includes("SQLite")
  ) {
    return false;
  }
  return originalEmit.call(process, name, data, ...rest);
};
