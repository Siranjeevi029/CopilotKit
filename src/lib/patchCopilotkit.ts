/* eslint-disable @typescript-eslint/no-explicit-any */
import { RunHandler } from "@copilotkitnext/core";

if (process.env.NODE_ENV !== "production") {
  console.warn("[CopilotKit] Patch module loaded");
}

function isValidJson(input: string): boolean {
  try {
    JSON.parse(input);
    return true;
  } catch {
    return false;
  }
}

function stripCodeFence(input: string): string {
  if (input.startsWith("```")) {
    const fenceMatch = input.match(/^```[a-zA-Z0-9_-]*\s*/);
    if (fenceMatch) {
      const withoutFence = input.slice(fenceMatch[0].length);
      if (withoutFence.endsWith("```")) {
        return withoutFence.slice(0, -3);
      }
      return withoutFence;
    }
  }
  return input;
}

function normalizeKeys(input: string): string {
  return input.replace(/([,{]\s*)([A-Za-z0-9_]+)(\s*):/g, (_, prefix, key, suffix) => {
    return `${prefix}"${key}"${suffix}:`;
  });
}

function extractJsonStructure(input: string): string | null {
  const start = input.search(/[\{\[]/);
  if (start === -1) {
    return null;
  }

  const stack: string[] = [];
  let inString = false;
  let escaping = false;

  for (let i = start; i < input.length; i += 1) {
    const ch = input[i];
    if (inString) {
      if (ch === "\"" && !escaping) {
        inString = false;
      }
      escaping = ch === "\\" && !escaping;
      continue;
    }

    if (ch === "\"") {
      inString = true;
      escaping = false;
      continue;
    }

    if (ch === "{" || ch === "[") {
      stack.push(ch);
      continue;
    }

    if (ch === "}" || ch === "]") {
      const expected = ch === "}" ? "{" : "[";
      const last = stack.pop();
      if (last !== expected) {
        return null;
      }
      if (stack.length === 0) {
        return input.slice(start, i + 1);
      }
    }
  }

  return null;
}

function appendMissingClosers(input: string): string | null {
  if (!input.startsWith("{") && !input.startsWith("[")) {
    return null;
  }

  const stack: string[] = [];
  let inString = false;
  let escaping = false;

  for (const ch of input) {
    if (inString) {
      if (ch === "\"" && !escaping) {
        inString = false;
      }
      escaping = ch === "\\" && !escaping;
      continue;
    }

    if (ch === "\"") {
      inString = true;
      escaping = false;
      continue;
    }

    if (ch === "{" || ch === "[") {
      stack.push(ch);
      continue;
    }

    if (ch === "}" || ch === "]") {
      const expected = ch === "}" ? "{" : "[";
      const last = stack.pop();
      if (last !== expected) {
        return null;
      }
    }
  }

  if (stack.length === 0 || inString) {
    return null;
  }

  let result = input;
  while (stack.length > 0) {
    const opener = stack.pop();
    if (opener === "{") {
      result += "}";
    } else if (opener === "[") {
      result += "]";
    }
  }

  return result;
}

function keyValueToJson(input: string): string | null {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  const entries: string[] = [];
  for (const line of lines) {
    const match = line.match(/^([A-Za-z0-9_]+)\s*[:=]\s*([\s\S]+)$/);
    if (!match) {
      return null;
    }
    const [, key, rawValue] = match;
    let value = rawValue.trim();
    if (value.endsWith(",")) {
      value = value.slice(0, -1).trim();
    }
    if (!value) {
      return null;
    }
    if (!/^("|\{|\[|\d|true|false|null)/i.test(value)) {
      value = JSON.stringify(value);
    }
    entries.push(`"${key}": ${value}`);
  }

  return `{${entries.join(",")}}`;
}

function truncateAfterFirstStructure(input: string): string | null {
  const structure = extractJsonStructure(input);
  if (!structure) {
    return null;
  }

  return structure;
}

function evaluateCandidate(raw: string, candidate: string, reason: string): string | null {
  if (!candidate) {
    return null;
  }

  if (isValidJson(candidate)) {
    let normalizedCandidate = candidate;
    try {
      normalizedCandidate = JSON.stringify(JSON.parse(candidate));
    } catch {
      // Keep original candidate if normalization fails
    }
    if (process.env.NODE_ENV !== "production") {
      console.warn("[CopilotKit] Tool args sanitized", {
        reason,
        raw,
        candidate: normalizedCandidate,
      });
    }
    return normalizedCandidate;
  }

  const normalized = normalizeKeys(candidate);
  if (normalized !== candidate && isValidJson(normalized)) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[CopilotKit] Tool args sanitized", {
        reason: `${reason} (normalized keys)` ,
        raw,
        candidate: JSON.stringify(JSON.parse(normalized)),
      });
    }
    return normalized;
  }

  return null;
}

function sanitizeToolArguments(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[CopilotKit] Tool args empty after trim", {
        raw,
      });
    }
    return trimmed;
  }

  const fenceStripped = stripCodeFence(trimmed).trim();
  const base = fenceStripped || trimmed;

  const attemptOrder: Array<{ candidate: string; reason: string }> = [];

  attemptOrder.push({ candidate: trimmed, reason: "original" });

  if (base !== trimmed) {
    attemptOrder.push({ candidate: base, reason: "Removed code fence from tool arguments" });
  }

  const extracted = truncateAfterFirstStructure(base);
  if (extracted && extracted !== base) {
    attemptOrder.push({ candidate: extracted, reason: "Extracted JSON object from tool arguments" });
  }

  const closed = appendMissingClosers(base);
  if (closed) {
    attemptOrder.push({ candidate: closed, reason: "Closed missing braces in tool arguments" });
  }

  const kvJson = keyValueToJson(base);
  if (kvJson) {
    attemptOrder.push({ candidate: kvJson, reason: "Converted key/value lines into JSON" });
  }

  const truncatedAtBrace = (() => {
    const lastBrace = base.lastIndexOf("}");
    if (lastBrace === -1) {
      return null;
    }
    return base.slice(0, lastBrace + 1);
  })();
  if (truncatedAtBrace && truncatedAtBrace !== base) {
    attemptOrder.push({ candidate: truncatedAtBrace, reason: "Truncated trailing characters after JSON" });
  }

  for (const attempt of attemptOrder) {
    const parsed = evaluateCandidate(trimmed, attempt.candidate, attempt.reason);
    if (parsed) {
      if (process.env.NODE_ENV !== "production" && parsed !== trimmed) {
        console.warn("[CopilotKit] Tool args final candidate", {
          original: trimmed,
          final: parsed,
          reason: attempt.reason,
        });
      }
      return parsed;
    }
  }

  if (process.env.NODE_ENV !== "production") {
    console.warn("[CopilotKit] Tool args fallback to raw", {
      raw: trimmed,
    });
  }

  return trimmed;
}

const runHandlerProto = RunHandler.prototype as any;

function safeRandomUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `tool-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeToolArgumentsString(rawArgs: unknown): string {
  if (typeof rawArgs === "string") {
    return rawArgs;
  }
  if (rawArgs == null) {
    return "";
  }
  try {
    return JSON.stringify(rawArgs);
  } catch {
    return String(rawArgs);
  }
}

runHandlerProto.executeSpecificTool = async function patchedExecuteSpecificTool(
  this: any,
  tool: any,
  toolCall: any,
  message: any,
  agent: any,
  agentId: any
) {
  if (tool?.agentId && tool.agentId !== agent.agentId) {
    return false;
  }

  let toolCallResult = "";
  let errorMessage: string | undefined;
  let isArgumentError = false;
  let parsedArgs: any;

  const existingArgs = normalizeToolArgumentsString(toolCall?.function?.arguments);
  const sanitizedArgs = sanitizeToolArguments(existingArgs);
  if (toolCall?.function) {
    toolCall.function.arguments = sanitizedArgs;
  }

  if (process.env.NODE_ENV !== "production") {
    console.warn("[CopilotKit] Parsing tool args", {
      toolName: toolCall?.function?.name,
      sanitizedArgs,
    });
  }

  if (tool?.handler) {
    if (!sanitizedArgs) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[CopilotKit] Skipping tool due to empty arguments", {
          toolName: toolCall?.function?.name,
          original: existingArgs,
        });
      }
      return false;
    }

    {
      try {
        parsedArgs = JSON.parse(sanitizedArgs);
        if (process.env.NODE_ENV !== "production") {
          console.warn("[CopilotKit] Tool args parsed", {
            tool: toolCall?.function?.name,
            args: parsedArgs,
          });
        }
      } catch (error) {
        const parseError = error instanceof Error ? error : new Error(String(error));
        errorMessage = parseError.message;
        isArgumentError = true;
        if (process.env.NODE_ENV !== "production") {
          console.error("[CopilotKit] JSON parse failed after sanitize", {
            sanitizedArgs,
            charCodes: Array.from(sanitizedArgs).map(
              (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`
            ),
            error: parseError,
          });
        }
        await this.core.emitError({
          error: parseError,
          code: "tool_argument_parse_failed",
          context: {
            agentId,
            toolCallId: toolCall?.id,
            toolName: toolCall?.function?.name,
            rawArguments: sanitizedArgs,
            toolType: "specific",
            messageId: message?.id,
          },
        });
      }
    }

    await this.core.notifySubscribers(
      (subscriber: any) =>
        subscriber.onToolExecutionStart?.({
          copilotkit: this.core,
          toolCallId: toolCall?.id,
          agentId,
          toolName: toolCall?.function?.name,
          args: parsedArgs,
        }),
      "Subscriber onToolExecutionStart error:"
    );

    if (!errorMessage) {
      try {
        const result = await tool.handler(parsedArgs, toolCall);
        if (result === void 0 || result === null) {
          toolCallResult = "";
        } else if (typeof result === "string") {
          toolCallResult = result;
        } else {
          toolCallResult = JSON.stringify(result);
        }
      } catch (error) {
        const handlerError = error instanceof Error ? error : new Error(String(error));
        errorMessage = handlerError.message;
        await this.core.emitError({
          error: handlerError,
          code: "tool_handler_failed",
          context: {
            agentId,
            toolCallId: toolCall?.id,
            toolName: toolCall?.function?.name,
            parsedArgs,
            toolType: "specific",
            messageId: message?.id,
          },
        });
      }
    }

    if (errorMessage) {
      toolCallResult = `Error: ${errorMessage}`;
    }

    await this.core.notifySubscribers(
      (subscriber: any) =>
        subscriber.onToolExecutionEnd?.({
          copilotkit: this.core,
          toolCallId: toolCall?.id,
          agentId,
          toolName: toolCall?.function?.name,
          result: errorMessage ? "" : toolCallResult,
          error: errorMessage,
        }),
      "Subscriber onToolExecutionEnd error:"
    );

    if (isArgumentError) {
      throw new Error(errorMessage ?? "Tool execution failed");
    }
  }

  if (!errorMessage || !isArgumentError) {
    const messageIndex = agent?.messages?.findIndex?.((m: any) => m.id === message?.id) ?? -1;
    const toolMessage = {
      id: safeRandomUUID(),
      role: "tool",
      toolCallId: toolCall?.id,
      content: toolCallResult,
    };
    if (messageIndex !== -1) {
      agent.messages.splice(messageIndex + 1, 0, toolMessage);
    } else {
      agent?.messages?.push?.(toolMessage);
    }
    if (!errorMessage && tool?.followUp !== false) {
      return true;
    }
  }

  return false;
};

runHandlerProto.executeWildcardTool = async function patchedExecuteWildcardTool(
  this: any,
  wildcardTool: any,
  toolCall: any,
  message: any,
  agent: any,
  agentId: any
) {
  if (wildcardTool?.agentId && wildcardTool.agentId !== agent.agentId) {
    return false;
  }

  let toolCallResult = "";
  let errorMessage: string | undefined;
  let isArgumentError = false;
  let parsedArgs: any;

  const existingArgs = normalizeToolArgumentsString(toolCall?.function?.arguments);
  const sanitizedArgs = sanitizeToolArguments(existingArgs);
  if (toolCall?.function) {
    toolCall.function.arguments = sanitizedArgs;
  }

  if (process.env.NODE_ENV !== "production") {
    console.warn("[CopilotKit] Parsing wildcard tool args", {
      toolName: toolCall?.function?.name,
      sanitizedArgs,
    });
  }

  if (wildcardTool?.handler) {
    if (!sanitizedArgs) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[CopilotKit] Skipping wildcard tool due to empty arguments", {
          toolName: toolCall?.function?.name,
          original: existingArgs,
        });
      }
      return false;
    }

    {
      try {
        parsedArgs = JSON.parse(sanitizedArgs);
      } catch (error) {
        const parseError = error instanceof Error ? error : new Error(String(error));
        errorMessage = parseError.message;
        isArgumentError = true;
        if (process.env.NODE_ENV !== "production") {
          console.error("[CopilotKit] JSON parse failed after sanitize (wildcard)", {
            sanitizedArgs,
            error: parseError,
          });
        }
        await this.core.emitError({
          error: parseError,
          code: "tool_argument_parse_failed",
          context: {
            agentId,
            toolCallId: toolCall?.id,
            toolName: toolCall?.function?.name,
            rawArguments: sanitizedArgs,
            toolType: "wildcard",
            messageId: message?.id,
          },
        });
      }
    }

    const wildcardArgs = {
      toolName: toolCall?.function?.name,
      args: parsedArgs,
    };

    await this.core.notifySubscribers(
      (subscriber: any) =>
        subscriber.onToolExecutionStart?.({
          copilotkit: this.core,
          toolCallId: toolCall?.id,
          agentId,
          toolName: toolCall?.function?.name,
          args: wildcardArgs,
        }),
      "Subscriber onToolExecutionStart error:"
    );

    if (!errorMessage) {
      try {
        const result = await wildcardTool.handler(wildcardArgs, toolCall);
        if (result === void 0 || result === null) {
          toolCallResult = "";
        } else if (typeof result === "string") {
          toolCallResult = result;
        } else {
          toolCallResult = JSON.stringify(result);
        }
      } catch (error) {
        const handlerError = error instanceof Error ? error : new Error(String(error));
        errorMessage = handlerError.message;
        await this.core.emitError({
          error: handlerError,
          code: "tool_handler_failed",
          context: {
            agentId,
            toolCallId: toolCall?.id,
            toolName: toolCall?.function?.name,
            parsedArgs: wildcardArgs,
            toolType: "wildcard",
            messageId: message?.id,
          },
        });
      }
    }

    if (errorMessage) {
      toolCallResult = `Error: ${errorMessage}`;
    }

    await this.core.notifySubscribers(
      (subscriber: any) =>
        subscriber.onToolExecutionEnd?.({
          copilotkit: this.core,
          toolCallId: toolCall?.id,
          agentId,
          toolName: toolCall?.function?.name,
          result: errorMessage ? "" : toolCallResult,
          error: errorMessage,
        }),
      "Subscriber onToolExecutionEnd error:"
    );

    if (isArgumentError) {
      throw new Error(errorMessage ?? "Tool execution failed");
    }
  }

  if (!errorMessage || !isArgumentError) {
    const messageIndex = agent?.messages?.findIndex?.((m: any) => m.id === message?.id) ?? -1;
    const toolMessage = {
      id: safeRandomUUID(),
      role: "tool",
      toolCallId: toolCall?.id,
      content: toolCallResult,
    };
    if (messageIndex !== -1) {
      agent.messages.splice(messageIndex + 1, 0, toolMessage);
    } else {
      agent?.messages?.push?.(toolMessage);
    }
    if (!errorMessage && wildcardTool?.followUp !== false) {
      return true;
    }
  }

  return false;
};
