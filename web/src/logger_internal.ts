type ConsoleMethod = 'log' | 'warn' | 'error' | 'info' | 'debug';

/**
 * Factory function to create a logger method that prepends a styled prefix
 * to console output for a specific console method.
 * @param {ConsoleMethod} method - The console method to wrap (e.g., "log", "warn", "error").
 * @returns {Function} A function that logs messages using the specified console method, with a styled prefix added to the output.
 */
const createLoggerMethod = (method: ConsoleMethod): Function =>
{
	return (...args: any[]) =>
	{
		console[method](
			'%c[Tojioo Passthrough]%c',
			'color: #00d4ff; font-weight: bold',
			'color: #888',
			...args
		);
	};
};

/**
 * Internal logging utility providing various logging levels.
 * This object encapsulates logging methods used for internal operations, allowing consistent and centralized log handling.
 *
 * Properties:
 * - log: Logs general messages.
 * - warn: Logs warning messages.
 * - error: Logs error messages.
 * - info: Logs informational messages.
 * - debug: Logs debugging details.
 * Each method is created by invoking the `createLoggerMethod` function with the corresponding log level.
 */
export const logger_internal = {
	log: createLoggerMethod('log'),
	warn: createLoggerMethod('warn'),
	error: createLoggerMethod('error'),
	info: createLoggerMethod('info'),
	debug: createLoggerMethod('debug'),
};