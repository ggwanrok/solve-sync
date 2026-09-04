"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type StudySearchField = "title" | "description" | "owner"

const searchFields = [
  { value: "title", label: "제목으로 검색" },
  { value: "description", label: "설명으로 검색" },
  { value: "owner", label: "방장 이름으로 검색" },
] as const

export function StudySearchFieldMenu({ defaultValue }: { defaultValue: StudySearchField }) {
  const [value, setValue] = useState<StudySearchField>(defaultValue)
  const [open, setOpen] = useState(false)
  const selectedField = searchFields.find((field) => field.value === value) || searchFields[0]

  return (
    <div className="sm:w-44">
      <input key={value} type="hidden" name="field" defaultValue={value} />
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="group/search-field flex h-11 w-full items-center gap-2 rounded-xl bg-muted/65 px-3.5 text-left text-sm font-medium ring-1 ring-foreground/[0.065] transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/45"
              aria-label={`검색 기준: ${selectedField.label}`}
            />
          }
        >
          <span className="min-w-0 flex-1 truncate">{selectedField.label}</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-popup-open/search-field:rotate-180" aria-hidden="true" />
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          sideOffset={4}
          className="origin-top p-1.5 data-open:slide-in-from-top-1"
        >
          <DropdownMenuRadioGroup
            value={value}
            onValueChange={(nextValue) => {
              setValue(nextValue as StudySearchField)
              setOpen(false)
            }}
          >
            {searchFields.map((field) => {
              return (
                <DropdownMenuRadioItem
                  key={field.value}
                  value={field.value}
                  className="min-h-10 rounded-xl px-3 pr-9 data-checked:bg-muted"
                >
                  {field.label}
                </DropdownMenuRadioItem>
              )
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
