import { CommandRegistry } from './CommandRegistry';

export interface Keybinding {
  key: string;
  command: string;
  when?: () => boolean;
}

class KeybindingRegistryImpl {
  private bindings: Keybinding[] = [];

  register(binding: Keybinding): void {
    this.bindings.push(binding);
  }

  unregister(key: string): void {
    this.bindings = this.bindings.filter(b => b.key !== key);
  }

  getForCommand(commandId: string): string | undefined {
    const binding = this.bindings.find(b => b.command === commandId);
    return binding?.key;
  }

  handleKeyDown(event: KeyboardEvent): boolean {
    const key = this.eventToKey(event);

    for (const binding of this.bindings) {
      if (binding.key === key) {
        if (binding.when && !binding.when()) {
          continue;
        }

        event.preventDefault();
        event.stopPropagation();

        CommandRegistry.execute(binding.command);
        return true;
      }
    }

    return false;
  }

  private eventToKey(event: KeyboardEvent): string {
    const parts: string[] = [];
    
    if (event.ctrlKey || event.metaKey) parts.push('ctrl');
    if (event.shiftKey) parts.push('shift');
    if (event.altKey) parts.push('alt');
    
    let key = event.key.toLowerCase();
    
    if (key === ' ') key = 'space';
    else if (key === 'escape') key = 'escape';
    else if (key === 'enter') key = 'enter';
    else if (key === 'backspace') key = 'backspace';
    else if (key === 'delete') key = 'delete';
    else if (key === 'tab') key = 'tab';
    else if (key === 'arrowup') key = 'up';
    else if (key === 'arrowdown') key = 'down';
    else if (key === 'arrowleft') key = 'left';
    else if (key === 'arrowright') key = 'right';
    
    if (!['ctrl', 'shift', 'alt', 'meta', 'control'].includes(key)) {
      parts.push(key);
    }
    
    return parts.join('+');
  }

  formatKey(key: string): string {
    return key
      .split('+')
      .map(part => {
        if (part === 'ctrl') return navigator.platform.includes('Mac') ? '⌘' : 'Ctrl';
        if (part === 'shift') return navigator.platform.includes('Mac') ? '⇧' : 'Shift';
        if (part === 'alt') return navigator.platform.includes('Mac') ? '⌥' : 'Alt';
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join(navigator.platform.includes('Mac') ? '' : '+');
  }
}

export const KeybindingRegistry = new KeybindingRegistryImpl();
