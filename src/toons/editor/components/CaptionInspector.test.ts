import { afterEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import CaptionInspector from "./CaptionInspector.vue";
import * as api from "../api";
import type { BubbleRecord } from "../types";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return { ...actual, uploadAudio: vi.fn() };
});

const bubble: BubbleRecord = {
  id: "b1",
  x: 0.2,
  y: 0.1,
  variant: "bubble",
  tail: "bottom-left",
  size: null,
  angle: null,
  textEn: "Hi",
  textJson: JSON.stringify({ en: "Hi", it: "Ciao" }),
  sort: 0,
};

describe("CaptionInspector", () => {
  afterEach(() => {
    vi.mocked(api.uploadAudio).mockReset();
  });

  it("puts variant and tail on the first row", () => {
    const wrapper = mount(CaptionInspector, { props: { bubble } });
    const variant = wrapper.get('select[name="variant"]');
    const tail = wrapper.get('select[name="tail"]');
    expect(variant.element.parentElement?.parentElement).toBe(tail.element.parentElement?.parentElement);
    expect(wrapper.get("label").text()).toContain("Variant");
  });

  it("shows one field per language and patches Italian without dropping English", async () => {
    const wrapper = mount(CaptionInspector, { props: { bubble } });
    const areas = wrapper.findAll("textarea[lang]");
    expect(areas).toHaveLength(4);
    expect((areas[0].element as HTMLTextAreaElement).value).toBe("Hi");
    expect((areas[1].element as HTMLTextAreaElement).value).toBe("Ciao");

    await areas[1].setValue("Ciao!");
    const patch = wrapper.emitted("change")?.[0][0] as Partial<BubbleRecord>;
    expect(patch.textEn).toBe("Hi");
    expect(JSON.parse(patch.textJson as string)).toEqual({ en: "Hi", it: "Ciao!" });
    expect(wrapper.emitted("preview")?.[0][0]).toBe("it");
  });

  it("emits a size patch", async () => {
    const wrapper = mount(CaptionInspector, { props: { bubble } });
    await wrapper.get('input[name="size"]').setValue("40");
    expect(wrapper.emitted("change")?.[0][0]).toEqual({ size: 40 });
  });

  it("does not clamp a leading 3 to 10 while typing 30", async () => {
    const wrapper = mount(CaptionInspector, { props: { bubble } });
    const input = wrapper.get('input[name="size"]');
    await input.trigger("focus");
    await input.setValue("3");
    expect(wrapper.emitted("change")?.[0][0]).toEqual({ size: 3 });
    await input.setValue("30");
    expect(wrapper.emitted("change")?.[1][0]).toEqual({ size: 30 });
    expect((input.element as HTMLInputElement).value).toBe("30");
  });

  it("clamps size on blur", async () => {
    const wrapper = mount(CaptionInspector, { props: { bubble } });
    const input = wrapper.get('input[name="size"]');
    await input.trigger("focus");
    await input.setValue("3");
    await input.trigger("blur");
    const last = wrapper.emitted("change")!.at(-1)![0] as Partial<BubbleRecord>;
    expect(last).toEqual({ size: 10 });
  });

  it("has a size slider from 10 to 100", async () => {
    const wrapper = mount(CaptionInspector, { props: { bubble } });
    const slider = wrapper.get('input[name="size-slider"]');
    expect((slider.element as HTMLInputElement).min).toBe("10");
    expect((slider.element as HTMLInputElement).max).toBe("100");
    await slider.setValue("48");
    expect(wrapper.emitted("change")?.[0][0]).toEqual({ size: 48 });
    expect((wrapper.get('input[name="size"]').element as HTMLInputElement).value).toBe("48");
  });

  it("has an angle slider from -45 to 45", async () => {
    const wrapper = mount(CaptionInspector, { props: { bubble } });
    const slider = wrapper.get('input[name="angle-slider"]');
    expect((slider.element as HTMLInputElement).min).toBe("-45");
    expect((slider.element as HTMLInputElement).max).toBe("45");
    await slider.setValue("-12");
    expect(wrapper.emitted("change")?.[0][0]).toEqual({ angle: -12 });
    expect((wrapper.get('input[name="angle"]').element as HTMLInputElement).value).toBe("-12");
  });

  it("clamps angle on blur", async () => {
    const wrapper = mount(CaptionInspector, { props: { bubble } });
    const input = wrapper.get('input[name="angle"]');
    await input.trigger("focus");
    await input.setValue("90");
    await input.trigger("blur");
    const last = wrapper.emitted("change")!.at(-1)![0] as Partial<BubbleRecord>;
    expect(last).toEqual({ angle: 45 });
  });

  it("patches audio into extraJson", async () => {
    const withVoice: BubbleRecord = {
      ...bubble,
      extraJson: JSON.stringify({ voice: "erin" }),
    };
    const wrapper = mount(CaptionInspector, { props: { bubble: withVoice } });
    await wrapper.get('input[name="audio"]').setValue("assets/sfx/a.mp3");
    const patch = wrapper.emitted("change")?.[0][0] as Partial<BubbleRecord>;
    expect(JSON.parse(patch.extraJson as string)).toEqual({ voice: "erin", audio: "assets/sfx/a.mp3" });
  });

  it("puts a small upload icon on the Audio label, not a full editor-btn", () => {
    const wrapper = mount(CaptionInspector, { props: { bubble, toonId: "t1" } });
    const btn = wrapper.get('button[name="audio-upload"]');
    expect(btn.classes()).toContain("editor-icon-btn");
    expect(btn.classes()).not.toContain("editor-btn");
    expect(btn.text().trim()).toBe("");
    expect(btn.attributes("aria-label")).toBe("Upload audio");
    expect(wrapper.get('input[name="audio-file"]').attributes("accept")).toBe("audio/mpeg,.mp3");
  });

  it("uploads a clip and patches the audio key", async () => {
    vi.mocked(api.uploadAudio).mockResolvedValue({
      key: "editor/demo/sfx/abc.mp3",
      url: "https://editor.example/media/editor/demo/sfx/abc.mp3",
      audio: "editor/demo/sfx/abc.mp3",
    });
    const wrapper = mount(CaptionInspector, { props: { bubble, toonId: "t1" } });
    const input = wrapper.get('input[name="audio-file"]');
    const file = new File([new Uint8Array([1, 2, 3])], "line.mp3", { type: "audio/mpeg" });
    Object.defineProperty(input.element, "files", { value: [file] });
    await input.trigger("change");
    await vi.waitFor(() => expect(api.uploadAudio).toHaveBeenCalledWith("t1", file));
    const patch = wrapper.emitted("change")!.at(-1)![0] as Partial<BubbleRecord>;
    expect(JSON.parse(patch.extraJson as string)).toEqual({ audio: "editor/demo/sfx/abc.mp3" });
  });

  it("emits remove", async () => {
    const wrapper = mount(CaptionInspector, { props: { bubble } });
    await wrapper.get('button[name="delete"]').trigger("click");
    expect(wrapper.emitted("remove")).toHaveLength(1);
  });

  it("patches voice into extraJson", async () => {
    const wrapper = mount(CaptionInspector, { props: { bubble } });
    await wrapper.get('select[name="voice"]').setValue("erin");
    const patch = wrapper.emitted("change")?.[0][0] as Partial<BubbleRecord>;
    expect(JSON.parse(patch.extraJson as string)).toEqual({ voice: "erin" });
  });

  it("puts a copy icon on the ElevenLabs prompt label", () => {
    const wrapper = mount(CaptionInspector, { props: { bubble } });
    const btn = wrapper.get('button[name="copy-prompt"]');
    expect(btn.attributes("aria-label")).toBe("Copy prompt");
    expect(btn.text().trim()).toBe("");
  });

  it("suggests an ElevenLabs Studio prompt from voice, text and variant", () => {
    const spoken: BubbleRecord = {
      ...bubble,
      variant: "thought",
      extraJson: JSON.stringify({ voice: "erin" }),
    };
    const wrapper = mount(CaptionInspector, { props: { bubble: spoken } });
    const prompt = (wrapper.get('textarea[name="eleven-prompt"]').element as HTMLTextAreaElement).value;
    expect(prompt).toContain("Voice: erin");
    expect(prompt).toContain("[whispers] Hi");
  });

  it("emits save only when the bubble is dirty", async () => {
    const wrapper = mount(CaptionInspector, { props: { bubble, dirty: false } });
    expect(wrapper.get('button[name="save"]').attributes("disabled")).toBeDefined();
    await wrapper.setProps({ dirty: true });
    await wrapper.get('button[name="save"]').trigger("click");
    expect(wrapper.emitted("save")).toHaveLength(1);
  });
});
