import { describe, it, expect, vi, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import ContactForm from "./ContactForm.vue";

describe("ContactForm", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders name, email, message fields", () => {
    const wrapper = mount(ContactForm);
    expect(wrapper.find("#name").exists()).toBe(true);
    expect(wrapper.find("#email").exists()).toBe(true);
    expect(wrapper.find("#message").exists()).toBe(true);
    expect(wrapper.find('button[type="submit"]').text()).toMatch(/Send Message/i);
  });

  it("shows validation errors on empty submit", async () => {
    const wrapper = mount(ContactForm);
    await wrapper.find("form").trigger("submit.prevent");
    expect(wrapper.text()).toMatch(/name/i);
    expect(wrapper.text()).toMatch(/email/i);
    expect(wrapper.text()).toMatch(/message/i);
  });

  it("shows email format error", async () => {
    const wrapper = mount(ContactForm);
    await wrapper.find("#name").setValue("Marco");
    await wrapper.find("#email").setValue("not-an-email");
    await wrapper.find("#message").setValue("Hello");
    await wrapper.find("form").trigger("submit.prevent");
    expect(wrapper.text()).toMatch(/valid email/i);
  });

  it("submits form data when valid", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "ok",
    });
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(ContactForm, {
      props: { action: "https://example.test/contact" },
    });

    await wrapper.find("#name").setValue("Marco");
    await wrapper.find("#email").setValue("marco@example.com");
    await wrapper.find("#message").setValue("Hello studio");
    await wrapper.find("form").trigger("submit.prevent");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.test/contact");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    const body = init.body as FormData;
    expect(body.get("name")).toBe("Marco");
    expect(body.get("email")).toBe("marco@example.com");
    expect(body.get("message")).toBe("Hello studio");
    expect(wrapper.text()).toMatch(/successfully/i);
  });

  it("shows error message when API fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        text: async () => "Server down",
      })
    );

    const wrapper = mount(ContactForm);
    await wrapper.find("#name").setValue("Marco");
    await wrapper.find("#email").setValue("marco@example.com");
    await wrapper.find("#message").setValue("Hello");
    await wrapper.find("form").trigger("submit.prevent");
    await flushPromises();

    expect(wrapper.text()).toMatch(/Server down/);
  });
});
