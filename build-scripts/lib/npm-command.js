const windowsNpmArgumentPattern = /^[A-Za-z0-9@._/:=+-]+$/u;

export function npmInvocation(args, { platform = process.platform, comspec = process.env.ComSpec } = {}) {
	if (platform !== "win32") return { command: "npm", args };

	for (const argument of args) {
		if (!windowsNpmArgumentPattern.test(argument)) {
			throw new Error(`Unsafe npm argument for Windows command execution: ${argument}`);
		}
	}

	return {
		command: comspec || "cmd.exe",
		args: ["/d", "/s", "/c", ["npm", ...args].join(" ")]
	};
}
