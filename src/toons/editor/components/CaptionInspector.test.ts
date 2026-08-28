import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import CaptionInspector from "./CaptionInspector.vue";
import type { BubbleRecord } from "../types";

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

  it("does not clamp a leading 3 to 8 while typing 30", async () => {
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
    expect(last).toEqual({ size: 8 });
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
