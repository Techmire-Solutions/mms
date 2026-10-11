import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi } from "vitest";
import { LlmConfigCard } from "./LlmConfigCard";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { LlmConfig } from "@mms/shared";

describe("LlmConfigCard", () => {
  const mockConfig: LlmConfig = {
    id: "cfg-1",
    name: "OpenAI GPT-4o",
    model: "gpt-4o",
    provider: "openai",
    apiKey: "sk-test",
    isDefaultText: false,
  };

  const mockT = ((key: string) => key) as unknown as TranslationFunction;

  const defaultProps = {
    config: mockConfig,
    status: "verified" as const,
    testingId: null,
    isGlobalDirty: false,
    t: mockT,
    openEditModal: vi.fn(),
    handleDeleteConfig: vi.fn(),
    handleTestConnection: vi.fn().mockResolvedValue(undefined),
  };

  it("renders card with start-edge accent stripe and inset", () => {
    const html = renderToStaticMarkup(<LlmConfigCard {...defaultProps} />);

    expect(html).toContain("relative overflow-hidden group/card");
    expect(html).toContain("ps-5 sm:ps-6");
    expect(html).toContain("absolute inset-y-0 start-0 w-1.5");
    expect(html).toContain("bg-primary/45 group-hover/card:bg-primary");
  });

  it("renders prominent stripe when isDefaultText is true", () => {
    const defaultTextConfig: LlmConfig = {
      ...mockConfig,
      isDefaultText: true,
    };

    const html = renderToStaticMarkup(
      <LlmConfigCard {...defaultProps} config={defaultTextConfig} />,
    );

    expect(html).toContain("bg-primary/80 group-hover/card:bg-primary");
    expect(html).toContain("settings.llmTextDefault");
  });
});
