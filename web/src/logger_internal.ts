type ConsoleMethod = 'log' | 'warn' | 'error' | 'info' | 'debug';

const METHOD_STYLES: Record<ConsoleMethod, { color: string; prefix: string }> = {
	log:   { color: "#00d4ff", prefix: "[Tojioo Passthrough]" },
	info:  { color: "#4a7fff", prefix: "ℹ [Tojioo Passthrough]" },
	warn:  { color: "#e6a117", prefix: "⚠ [Tojioo Passthrough]" },
	error: { color: "#e05252", prefix: "✖ [Tojioo Passthrough]" },
	debug: { color: "#b07aff", prefix: "[Tojioo Passthrough]" },
};

/**
 * Factory function to create a logger method that prepends a styled prefix
 * to console output for a specific console method.
 */
const createLoggerMethod = (method: ConsoleMethod): Function =>
{
	const { color, prefix } = METHOD_STYLES[method];
	return (...args: any[]) =>
	{
		console[method](
			`%c${prefix}%c`,
			`color: ${color}; font-weight: bold`,
			'color: #888',
			...args
		);
	};
};

/**
 * Internal logging utility providing various logging levels.
 */
export const logger_internal = {
	log: createLoggerMethod('log'),
	warn: createLoggerMethod('warn'),
	error: createLoggerMethod('error'),
	info: createLoggerMethod('info'),
	debug: createLoggerMethod('debug'),
};