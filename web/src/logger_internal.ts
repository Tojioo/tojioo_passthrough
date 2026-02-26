type ConsoleMethod = 'log' | 'warn' | 'error' | 'info' | 'debug';

const METHOD_STYLES: Record<ConsoleMethod, { color: string; prefix: string }> = {
	log: {color: "#00d4ff", prefix: "[Tojioo Passthrough]"},
	info: {color: "#4a7fff", prefix: "ℹ [Tojioo Passthrough]"},
	warn: {color: "#e6a117", prefix: "⚠ [Tojioo Passthrough]"},
	error: {color: "#e05252", prefix: "✖ [Tojioo Passthrough]"},
	debug: {color: "#b07aff", prefix: "[Tojioo Passthrough]"},
};

const createLoggerMethod = (method: ConsoleMethod, scope?: string): Function =>
{
	const {color, prefix} = METHOD_STYLES[method];

	if (scope)
	{
		return (...args: any[]) =>
		{
			console[method](
				`%c${prefix}%c ${scope}:%c`,
				`color: ${color}; font-weight: bold`,
				'color: yellow;',
				'color: inherit',
				...args
			);
		};
	}
	else
	{
		return (...args: any[]) =>
		{
			console[method](
				`%c${prefix}%c`,
				`color: ${color}; font-weight: bold`,
				'color: inherit',
				...args
			);
		};
	}
};

const loggerInstance = (scope?: string) => ({
	log: createLoggerMethod('log'),
	warn: createLoggerMethod('warn'),
	error: createLoggerMethod('error', scope),
	info: createLoggerMethod('info'),
	debug: createLoggerMethod('debug', scope),
});

const logger_internal = loggerInstance();

export default logger_internal;
export {loggerInstance};