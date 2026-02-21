# SPDX-License-Identifier: GPL-3.0-only
# Tojioo Passthrough Nodes - Logging Module
# Copyright (c) 2025 Tojioo
# Licensed under the GNU General Public License v3.0 only.
# See https://www.gnu.org/licenses/gpl-3.0.txt

"""
Logging helper module for Tojioo Passthrough Nodes.
Integrates with ComfyUI's logging system for consistent log output.
"""

import logging
import sys
from typing import Optional


_MODULE_NAME = "TojiooPassthrough"

_LEVEL_STYLES = {
	logging.DEBUG: ("\033[95m", "[Tojioo Passthrough]"),  # Purple
	logging.INFO: ("\033[94m", "ℹ [Tojioo Passthrough]"),  # Deep blue
	logging.WARNING: ("\033[93m", "⚠ [Tojioo Passthrough]"),  # Yellow-orange
	logging.ERROR: ("\033[91m", "✖ [Tojioo Passthrough]"),  # Red
	logging.CRITICAL: ("\033[91m", "✖ [Tojioo Passthrough]"),  # Red
}

_RESET = "\033[0m"
_DIM = "\033[2m"


class _TojiooFormatter(logging.Formatter):

	def format(self, record: logging.LogRecord) -> str:
		color, prefix = _LEVEL_STYLES.get(record.levelno, ("\033[96m", "[Tojioo Passthrough]"))
		message = record.getMessage()
		base = f"{color}{prefix}{_RESET} {_DIM}{message}{_RESET}"

		if record.exc_info and record.exc_info[1] is not None:
			base += "\n" + self.formatException(record.exc_info)

		return base


class _SafeStreamHandler(logging.StreamHandler):
	"""Survives pytest/IDE output capture swapping/closing stdout."""


	def emit(self, record):
		try:
			if self.stream is None or getattr(self.stream, "closed", False):
				self.setStream(getattr(sys, "__stdout__", sys.stdout))
			super().emit(record)
		except ValueError:
			try:
				self.setStream(getattr(sys, "__stderr__", sys.stderr))
				super().emit(record)
			except Exception:
				pass


def _get_logger(name: str) -> logging.Logger:
	logger = logging.getLogger(f"{_MODULE_NAME}.{name}")

	if not logger.handlers:
		logger.setLevel(logging.DEBUG)

		stream = getattr(sys, "__stdout__", sys.stdout)
		handler = _SafeStreamHandler(stream)
		handler.setLevel(logging.DEBUG)
		handler.setFormatter(_TojiooFormatter())

		logger.addHandler(handler)
		logger.propagate = False

	return logger


def get_logger(module_name: str) -> logging.Logger:
	"""
	Retrieve a logger instance for the given module.

	The function extracts the base name of the module and retrieves
	a named logger specific to that base name, facilitating organized
	and modularized logging for different parts of the codebase.

	Args:
	    module_name (str): The fully qualified name of the module.

	Returns:
	    logging.Logger: A configured logger instance for the module.
	"""
	base_name = module_name.rsplit(".", 1)[-1]
	return _get_logger(base_name)


def log_info(message: str, module: str = "Core", exception: Optional[Exception] = None) -> None:
	"""
	Logs an informational message using the specified logger. Optionally includes
	exception details for debugging purposes.

	Args:
	    message: The log message to be recorded.
	    module: The name of the module or component for categorizing the log.
	    exception: An optional exception object to include additional details in
	        the log.
	"""
	logger = get_logger(module)
	logger.info(message, exc_info = exception)


def log_warning(message: str, module: str = "Core", exception: Optional[Exception] = None) -> None:
	"""
	Logs a warning message with an optional exception for a specified module.

	Logs warnings to the module's logger for proper identification and debugging.

	Args:
	    message (str): The warning message to log.
	    module (str): The module name for the logger. Defaults to "Core".
	    exception (Optional[Exception]): An optional exception to include
	        in the log.
	"""
	logger = get_logger(module)
	logger.warning(message, exc_info = exception)


def log_debug(message: str, module: str = "Core", exception: Optional[Exception] = None) -> None:
	"""
	Logs a debug message for a specified module, optionally including exception information.

	Parameters:
	message: str
	    The debug message to log.
	module: str, optional
	    The name of the module where the message is logged. Defaults to "Core".
	exception: Optional[Exception], optional
	    An exception object to include with the log, if any.
	"""
	logger = get_logger(module)
	logger.debug(message, exc_info = exception)


def log_error(message: str, module: str = "Core", exception: Optional[Exception] = None) -> None:
	"""
	Logs an error message with the provided module and optional exception details.

	Args:
	    message: The error message to log.
	    module: The name of the module where the log is originating. Defaults to "Core".
	    exception: An optional exception instance to include in the log for additional context.
	"""
	logger = get_logger(module)
	logger.error(message, exc_info = exception)


__all__ = ["get_logger", "log_info", "log_warning", "log_debug", "log_error"]