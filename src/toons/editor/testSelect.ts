/**
 * EditorSelect (Reka's Select) replaced native <select> in the editor forms —
 * .setValue() / .find('option[value=…]') no longer apply. This drives the
 * same interaction a real user does: open the trigger, click the option by
 * its visible text. Reka teleports the listbox to document.body, same as
 * the editor's dialogs, so this queries there rather than within `wrapper`.
 */
import { flushPromises } from "@vue/test-utils";

export async function pickOption(triggerName: string, optionText: string): Promise<void> {
  const trigger = document.querySelector(`button[name="${triggerName}"]`);
  if (!trigger) throw new Error(`No select trigger named "${triggerName}"`);
  trigger.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  await flushPromises();
  const options = [...document.querySelectorAll('[role="option"]')];
  const match = options.find((el) => el.textContent?.trim() === optionText);
  if (!match) {
    const seen = options.map((el) => el.textContent?.trim());
    throw new Error(`No option "${optionText}" for "${triggerName}" — saw: ${JSON.stringify(seen)}`);
  }
  match.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
  await flushPromises();
}
