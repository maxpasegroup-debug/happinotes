'use client';

import {
  Button, Checkbox, Input, Progress, Select, SelectItem, Textarea,
  type ButtonProps, type CheckboxProps, type InputProps, type TextAreaProps,
} from '@heroui/react';
import {
  Children, createContext, isValidElement, useContext,
  type FieldsetHTMLAttributes, type InputHTMLAttributes,
  type OptionHTMLAttributes, type ReactElement, type SelectHTMLAttributes,
  type CSSProperties, type ChangeEvent, type ReactNode,
} from 'react';

const DisabledContext = createContext(false);

/** Preserve native fieldset disabling for portalled HeroUI controls as well. */
export function AdminFieldset({ disabled, children, ...props }: FieldsetHTMLAttributes<HTMLFieldSetElement>) {
  const parent = useContext(DisabledContext);
  return <DisabledContext.Provider value={parent || Boolean(disabled)}>
    <fieldset {...props} disabled={parent || disabled}>{children}</fieldset>
  </DisabledContext.Provider>;
}

function layoutClasses(value = '') {
  return value.split(/\s+/).filter((part) => /^(?:(?:sm|md|lg|xl):)?(?:m[trblxy]?-|w-|min-w-|max-w-|h-|min-h-|max-h-|flex-|self-|justify-|items-|gap-|col-|row-|hidden$|block$|inline-flex$)/.test(part)).join(' ');
}
function layoutStyle(style?: CSSProperties): CSSProperties | undefined {
  if (!style) return undefined;
  return Object.fromEntries(Object.entries(style).filter(([key]) => /^(width|minWidth|maxWidth|height|minHeight|maxHeight|margin.*|display|flex.*|align.*|justify.*|gap|grid.*|position|top|left|right|bottom|zIndex)$/.test(key))) as CSSProperties;
}

export function AdminButton({ disabled, isDisabled, className = '', style, color, variant, type = 'button', ...props }: ButtonProps & { disabled?: boolean }) {
  const inherited = useContext(DisabledContext);
  const primary = /bg-(?:orange|\[#(?:f97316|F27055|ff735f)\])/.test(className) || style?.background === '#f97316';
  const selected = /bg-\[#1a1f33\]/.test(className);
  const tone = color ?? (primary || selected ? 'primary' : /(?:text|border)-(?:red|rose)/.test(className) ? 'danger' : /(?:text|border)-emerald/.test(className) ? 'success' : /(?:text|border)-amber/.test(className) ? 'warning' : 'default');
  return <Button {...props} type={type} color={tone} variant={variant ?? (primary ? 'solid' : 'flat')} radius="lg" size="sm" isDisabled={inherited || disabled || isDisabled}
    className={`min-h-10 font-semibold ${layoutClasses(className)}`} style={layoutStyle(style)} />;
}

type NativeInputProps = Omit<InputProps, 'size' | 'value' | 'defaultValue'> & {
  value?: InputHTMLAttributes<HTMLInputElement>['value'];
  defaultValue?: InputHTMLAttributes<HTMLInputElement>['defaultValue'];
  defaultChecked?: boolean;
  disabled?: boolean;
  required?: boolean;
};

/** Event handlers still receive native inputs, including files and valueAsNumber. */
export function AdminInput({ disabled, required, className = '', style, value, defaultValue, type, ...props }: NativeInputProps) {
  const inherited = useContext(DisabledContext);
  const isDisabled = inherited || disabled || props.isDisabled;
  if (type === 'file' || type === 'hidden' || props.list) {
    const { isDisabled: unusedDisabled, isRequired: unusedRequired, ...nativeProps } = props;
    void unusedDisabled; void unusedRequired;
    return <input {...nativeProps as InputHTMLAttributes<HTMLInputElement>} type={type} value={value} defaultValue={defaultValue} disabled={isDisabled} required={required} style={layoutStyle(style)}
      className={`admin-native-input ${type === 'file' ? 'admin-file-input' : ''} ${layoutClasses(className)}`} />;
  }
  if (type === 'checkbox') {
    return <Checkbox as="span" size="sm" color="primary" isSelected={props.checked} defaultSelected={props.defaultChecked} isDisabled={isDisabled}
      onChange={props.onChange} name={props.name} id={props.id} aria-label={props['aria-label'] ?? 'Toggle option'}
      isRequired={required || props.isRequired}
      className={`m-0 p-0 shrink-0 ${layoutClasses(className)}`} classNames={{ wrapper: 'm-0 shrink-0' }} />;
  }
  return <Input {...props} type={type} value={value === undefined ? undefined : String(value)} defaultValue={defaultValue === undefined ? undefined : String(defaultValue)}
    isDisabled={isDisabled} isRequired={required || props.isRequired} validationBehavior="native" variant="bordered" radius="lg" size="sm"
    className={layoutClasses(className)} style={layoutStyle(style)}
    classNames={{ inputWrapper: 'min-h-11 border border-default-200 bg-content2/40 data-[hover=true]:bg-content2 group-data-[focus=true]:border-primary shadow-none', input: 'text-sm text-foreground placeholder:text-default-400' }} />;
}

/** Keep the control and its clickable label in one correctly sized HeroUI field. */
export function AdminCheckbox({ disabled, isDisabled, className = '', ...props }: CheckboxProps & { disabled?: boolean }) {
  const inherited = useContext(DisabledContext);
  return <Checkbox {...props} size="sm" color="primary" isDisabled={inherited || disabled || isDisabled}
    className={`m-0 max-w-full gap-3 p-0 ${className}`}
    classNames={{ wrapper: 'm-0 shrink-0', label: 'min-w-0 text-sm leading-6 text-default-600 whitespace-normal' }} />;
}

export function AdminTextarea({ disabled, required, className = '', style, rows, ...props }: TextAreaProps & { disabled?: boolean; required?: boolean; rows?: number }) {
  const inherited = useContext(DisabledContext);
  return <Textarea {...props} isDisabled={inherited || disabled || props.isDisabled} isRequired={required || props.isRequired} validationBehavior="native"
    minRows={rows ?? 3} variant="bordered" radius="lg" className={layoutClasses(className)} style={layoutStyle(style)}
    classNames={{ inputWrapper: 'border border-default-200 bg-content2/40 shadow-none', input: 'text-sm text-foreground' }} />;
}

export function AdminSelect({ children, label, disabled, required, className = '', style, value, defaultValue, onChange, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label?: ReactNode }) {
  const inherited = useContext(DisabledContext);
  const options = Children.toArray(children).filter(isValidElement) as ReactElement<OptionHTMLAttributes<HTMLOptionElement>>[];
  // Prefix every key so the empty filter option cannot collide with real values.
  const keyOf = (value: unknown) => `option:${String(value ?? '')}`;
  const optionText = (node: ReactNode): string => Children.toArray(node).map((child): string =>
    isValidElement<{ children?: ReactNode }>(child) ? optionText(child.props.children) : String(child),
  ).join('');
  const entries = options.map((option) => ({
    value: String(option.props.value ?? optionText(option.props.children)),
    text: option.props.children,
    textValue: optionText(option.props.children),
    disabled: option.props.disabled,
  }));
  return <Select
    name={props.name} id={props.id} label={label} labelPlacement="outside"
    aria-label={props['aria-label'] ?? (label ? undefined : props.name ?? 'Choose an option')}
    aria-labelledby={props['aria-labelledby']} aria-describedby={props['aria-describedby']}
    isDisabled={inherited || disabled} isRequired={required} validationBehavior="native"
    disallowEmptySelection
    selectedKeys={value === undefined ? undefined : [keyOf(value)]}
    defaultSelectedKeys={defaultValue === undefined ? undefined : [keyOf(defaultValue)]}
    disabledKeys={entries.filter((entry) => entry.disabled).map((entry) => keyOf(entry.value))}
    onChange={(event: ChangeEvent<HTMLSelectElement>) => {
      const entry = entries.find((entry) => keyOf(entry.value) === event.target.value);
      if (!entry) return;
      // Preserve the native-style value contract without mutating HeroUI's event.
      const target = { ...event.target, value: entry.value };
      onChange?.({ ...event, target, currentTarget: target });
    }}
    variant="bordered" radius="lg" size="sm" className={`min-w-36 ${layoutClasses(className)}`} style={layoutStyle(style)}
    popoverProps={{ classNames: { content: 'dark bg-content1 text-foreground border border-divider' } }}
    classNames={{ trigger: 'min-h-11 border border-default-200 bg-content2/40 shadow-none', value: 'text-sm text-foreground' }}
  >
    {entries.map((entry) => <SelectItem key={keyOf(entry.value)} textValue={entry.textValue}>{entry.text}</SelectItem>)}
  </Select>;
}

export function AdminProgress({ value, max = 100, className = '', ...props }: { value?: number | string | readonly string[]; max?: number | string; className?: string; 'aria-label'?: string }) {
  const percent = Math.max(0, Math.min(100, Number(value ?? 0) / Number(max) * 100));
  return <Progress aria-label={props['aria-label'] ?? 'Upload progress'} value={percent} color="primary" size="sm" radius="full" className={layoutClasses(className)} />;
}
