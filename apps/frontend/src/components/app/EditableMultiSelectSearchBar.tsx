import React from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface EditableMultiSelectSearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onClearSearch: () => void;
  t: TranslationFunction;
}

export const EditableMultiSelectSearchBar = React.memo(function EditableMultiSelectSearchBar({
  searchQuery,
  onSearchChange,
  onClearSearch,
  t,
}: EditableMultiSelectSearchBarProps): React.JSX.Element {
  return (
    <div className="p-2 flex items-center gap-2 bg-muted/20">
      <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
      <Input
        type="text"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={t("common.search")}
        aria-label={t("common.search")}
        data-listbox-search=""
        className="h-8 text-xs bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-1 shadow-none"
      />
      {searchQuery && (
        <button
          type="button"
          onClick={onClearSearch}
          className="text-muted-foreground hover:text-foreground cursor-pointer"
          aria-label={t("common.clearSearch")}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
});
