import { test, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MessageList } from "../MessageList";
import type { UIMessage } from "ai";

// Mock the MarkdownRenderer component
vi.mock("../MarkdownRenderer", () => ({
  MarkdownRenderer: ({ content }: { content: string }) => <div>{content}</div>,
}));

afterEach(() => {
  cleanup();
});

function makeUserMsg(id: string, text: string): UIMessage {
  return { id, role: "user", parts: [{ type: "text", text }] };
}

function makeAssistantMsg(id: string, text: string): UIMessage {
  return { id, role: "assistant", parts: [{ type: "text", text }] };
}

test("MessageList shows empty state when no messages", () => {
  render(<MessageList messages={[]} />);

  expect(
    screen.getByText("Start a conversation to generate React components")
  ).toBeDefined();
  expect(
    screen.getByText("I can help you create buttons, forms, cards, and more")
  ).toBeDefined();
});

test("MessageList renders user messages", () => {
  const messages: UIMessage[] = [makeUserMsg("1", "Create a button component")];

  render(<MessageList messages={messages} />);

  expect(screen.getByText("Create a button component")).toBeDefined();
});

test("MessageList renders assistant messages", () => {
  const messages: UIMessage[] = [
    makeAssistantMsg("1", "I'll help you create a button component."),
  ];

  render(<MessageList messages={messages} />);

  expect(
    screen.getByText("I'll help you create a button component.")
  ).toBeDefined();
});

test("MessageList renders messages with parts", () => {
  const messages: UIMessage[] = [
    {
      id: "1",
      role: "assistant",
      parts: [
        { type: "text", text: "Creating your component..." },
        {
          type: "dynamic-tool",
          toolName: "str_replace_editor",
          toolCallId: "asdf",
          state: "output-available",
          input: {},
          output: "Success",
        } as any,
      ],
    },
  ];

  render(<MessageList messages={messages} />);

  expect(screen.getByText("Creating your component...")).toBeDefined();
  expect(screen.getByText("str_replace_editor")).toBeDefined();
});

test("MessageList shows loading for last assistant message without parts", () => {
  const messages: UIMessage[] = [
    {
      id: "1",
      role: "assistant",
      parts: [],
    },
  ];

  render(<MessageList messages={messages} isLoading={true} />);

  expect(screen.getByText("Generating...")).toBeDefined();
});

test("MessageList doesn't show loading state for non-last messages", () => {
  const messages: UIMessage[] = [
    makeAssistantMsg("1", "First response"),
    makeUserMsg("2", "Another request"),
  ];

  render(<MessageList messages={messages} isLoading={true} />);

  expect(screen.queryByText("Generating...")).toBeNull();
});

test("MessageList renders reasoning parts", () => {
  const messages: UIMessage[] = [
    {
      id: "1",
      role: "assistant",
      parts: [
        { type: "text", text: "Let me analyze this." },
        {
          type: "reasoning",
          reasoning: "The user wants a button component with specific styling.",
        } as any,
      ],
    },
  ];

  render(<MessageList messages={messages} />);

  expect(screen.getByText("Reasoning")).toBeDefined();
  expect(
    screen.getByText("The user wants a button component with specific styling.")
  ).toBeDefined();
});

test("MessageList renders multiple messages in correct order", () => {
  const messages: UIMessage[] = [
    makeUserMsg("1", "First user message"),
    makeAssistantMsg("2", "First assistant response"),
    makeUserMsg("3", "Second user message"),
    makeAssistantMsg("4", "Second assistant response"),
  ];

  const { container } = render(<MessageList messages={messages} />);

  const messageContainers = container.querySelectorAll(".rounded-xl");

  expect(messageContainers).toHaveLength(4);

  expect(messageContainers[0].textContent).toContain("First user message");
  expect(messageContainers[1].textContent).toContain("First assistant response");
  expect(messageContainers[2].textContent).toContain("Second user message");
  expect(messageContainers[3].textContent).toContain("Second assistant response");
});

test("MessageList handles step-start parts", () => {
  const messages: UIMessage[] = [
    {
      id: "1",
      role: "assistant",
      parts: [
        { type: "text", text: "Step 1 content" },
        { type: "step-start" } as any,
        { type: "text", text: "Step 2 content" },
      ],
    },
  ];

  render(<MessageList messages={messages} />);

  expect(screen.getByText("Step 1 content")).toBeDefined();
  expect(screen.getByText("Step 2 content")).toBeDefined();
  const container = screen.getByText("Step 1 content").closest(".rounded-xl");
  expect(container?.querySelector("hr")).toBeDefined();
});

test("MessageList applies correct styling for user vs assistant messages", () => {
  const messages: UIMessage[] = [
    makeUserMsg("1", "User message"),
    makeAssistantMsg("2", "Assistant message"),
  ];

  render(<MessageList messages={messages} />);

  const userMessage = screen.getByText("User message").closest(".rounded-xl");
  const assistantMessage = screen
    .getByText("Assistant message")
    .closest(".rounded-xl");

  expect(userMessage?.className).toContain("bg-blue-600");
  expect(userMessage?.className).toContain("text-white");

  expect(assistantMessage?.className).toContain("bg-white");
  expect(assistantMessage?.className).toContain("text-neutral-900");
});

test("MessageList handles parts with text content", () => {
  const messages: UIMessage[] = [
    {
      id: "1",
      role: "assistant",
      parts: [{ type: "text", text: "This is from parts" }],
    },
  ];

  render(<MessageList messages={messages} />);

  expect(screen.getByText("This is from parts")).toBeDefined();
});

test("MessageList shows loading for assistant message with empty parts", () => {
  const messages: UIMessage[] = [
    {
      id: "1",
      role: "assistant",
      parts: [],
    },
  ];

  const { container } = render(
    <MessageList messages={messages} isLoading={true} />
  );

  const loadingText = container.querySelectorAll(".text-neutral-500");
  const generatingElements = Array.from(loadingText).filter(
    (el) => el.textContent === "Generating..."
  );
  expect(generatingElements).toHaveLength(1);
});
