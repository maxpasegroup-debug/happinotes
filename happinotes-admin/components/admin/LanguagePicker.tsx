'use client';

import { Autocomplete, AutocompleteItem } from '@heroui/react';
import { useMemo, useState } from 'react';
import { contentLanguages, languageByKey, searchContentLanguages, selectedLanguageKey } from '@/lib/content-languages';

type Props = {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
};

export default function LanguagePicker({ value, onChange, error, disabled }: Props) {
  const [query, setQuery] = useState('');
  const items = useMemo(() => searchContentLanguages(query), [query]);
  return (
    <Autocomplete
      label={
        <span className="inline-flex flex-wrap items-center gap-2">
          <span>Language</span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
            {contentLanguages.length.toLocaleString('en-US')} options supported
          </span>
        </span>
      }
      aria-label="Language"
      labelPlacement="outside"
      placeholder="Search Indian or world languages…"
      variant="bordered"
      radius="lg"
      allowsCustomValue
      isVirtualized
      itemHeight={56}
      maxListboxHeight={280}
      isDisabled={disabled}
      isInvalid={Boolean(error)}
      errorMessage={error}
      inputValue={value}
      selectedKey={selectedLanguageKey(value)}
      items={items}
      onInputChange={(text) => { setQuery(text); onChange(text); }}
      onOpenChange={(open, trigger) => { if (open && trigger === 'manual') setQuery(''); }}
      onSelectionChange={(key) => {
        if (key !== null) {
          const language = languageByKey.get(String(key));
          if (language) onChange(language.name);
        }
      }}
      description="Search languages, language groups and dialects by name, native name or ISO code. You can also enter a custom name."
      inputProps={{
        maxLength: 160,
        classNames: {
          label: 'text-sm font-medium text-foreground-600',
          inputWrapper: 'min-h-12 border-default-200 bg-content2/50 data-[hover=true]:border-default-400 group-data-[focus=true]:border-primary shadow-none',
          input: 'text-sm', description: 'text-xs leading-relaxed text-foreground-500',
        },
      }}
      popoverProps={{ classNames: { content: 'admin-ui border border-divider bg-content1 text-foreground shadow-xl' } }}
      listboxProps={{
        emptyContent: value.trim() ? `Use “${value.trim()}” as a custom language.` : 'Type a language name.',
        itemClasses: { base: 'h-14 rounded-lg data-[hover=true]:bg-default-100 data-[selected=true]:bg-primary/10', title: 'truncate text-sm', description: 'truncate text-xs text-foreground-500' },
      }}
    >
      {(language) => (
        <AutocompleteItem key={language.key} textValue={language.name} description={language.description}>
          {language.name}
        </AutocompleteItem>
      )}
    </Autocomplete>
  );
}
