"use client"

import { useEffect, useRef } from "react"
import { indentWithTab } from "@codemirror/commands"
import { languages } from "@codemirror/language-data"
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language"
import { Compartment, EditorState, Prec } from "@codemirror/state"
import { EditorView, keymap, placeholder as codeMirrorPlaceholder } from "@codemirror/view"
import { tags } from "@lezer/highlight"
import { basicSetup } from "codemirror"
import { CODEMIRROR_LANGUAGE_NAMES, codeLanguageMode } from "@/lib/code-language"
import { cn } from "@/lib/utils"

const memoHighlightStyle = HighlightStyle.define([
  { tag: [tags.keyword, tags.controlKeyword, tags.operatorKeyword], color: "var(--chart-4)", fontWeight: "600" },
  { tag: [tags.string, tags.special(tags.string), tags.character], color: "var(--primary)" },
  { tag: [tags.number, tags.bool, tags.null], color: "var(--chart-3)" },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: "var(--muted-foreground)", fontStyle: "italic" },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: "var(--chart-4)" },
  { tag: [tags.typeName, tags.className, tags.namespace], color: "var(--chart-5)" },
  { tag: [tags.definition(tags.variableName), tags.definition(tags.propertyName)], color: "var(--foreground)" },
  { tag: [tags.regexp, tags.escape], color: "var(--chart-2)" },
  { tag: [tags.invalid], color: "var(--destructive)", textDecoration: "underline" },
])

const memoEditorTheme = EditorView.theme({
  "&": {
    minHeight: "13rem",
    backgroundColor: "transparent",
    color: "var(--foreground)",
    fontSize: "13px",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    maxHeight: "32rem",
    fontFamily: "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    lineHeight: "1.5",
  },
  ".cm-content": {
    minHeight: "13rem",
    padding: "0.75rem 0",
    caretColor: "var(--foreground)",
  },
  ".cm-line": { padding: "0 0.875rem" },
  ".cm-gutters": {
    borderRight: "1px solid var(--border)",
    backgroundColor: "transparent",
    color: "var(--muted-foreground)",
  },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 0.625rem 0 0.75rem" },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "color-mix(in oklab, var(--primary) 8%, transparent)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "color-mix(in oklab, var(--primary) 22%, transparent) !important",
  },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--foreground)" },
  ".cm-placeholder": { color: "var(--muted-foreground)" },
  ".cm-panels, .cm-tooltip": {
    backgroundColor: "var(--popover)",
    color: "var(--popover-foreground)",
  },
  ".cm-panels": { borderColor: "var(--border)" },
  ".cm-tooltip": { borderColor: "var(--border)" },
})

type SolutionCodeEditorProps = {
  id: string
  value: string
  language: string | null
  maxLength: number
  placeholder: string
  ariaLabelledBy: string
  onChange: (value: string) => void
  className?: string
}

export function SolutionCodeEditor({
  id,
  value,
  language,
  maxLength,
  placeholder,
  ariaLabelledBy,
  onChange,
  className,
}: SolutionCodeEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const languageCompartmentRef = useRef<Compartment | null>(null)
  const initialValueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  const mode = codeLanguageMode(language)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!hostRef.current) return

    const languageCompartment = new Compartment()
    languageCompartmentRef.current = languageCompartment
    const state = EditorState.create({
      doc: initialValueRef.current.slice(0, maxLength),
      extensions: [
        basicSetup,
        Prec.highest(keymap.of([indentWithTab])),
        languageCompartment.of([]),
        syntaxHighlighting(memoHighlightStyle),
        memoEditorTheme,
        EditorView.lineWrapping,
        codeMirrorPlaceholder(placeholder),
        EditorView.contentAttributes.of({
          "aria-labelledby": ariaLabelledBy,
          autocapitalize: "off",
          autocomplete: "off",
          autocorrect: "off",
          spellcheck: "false",
        }),
        EditorState.changeFilter.of((transaction) => !transaction.docChanged || transaction.newDoc.length <= maxLength),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString())
        }),
      ],
    })

    const view = new EditorView({ state, parent: hostRef.current })
    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
      languageCompartmentRef.current = null
    }
  }, [ariaLabelledBy, maxLength, placeholder])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return

    const nextValue = value.slice(0, maxLength)
    if (view.state.doc.toString() === nextValue) return
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: nextValue } })
  }, [maxLength, value])

  useEffect(() => {
    const view = viewRef.current
    const languageCompartment = languageCompartmentRef.current
    if (!view || !languageCompartment) return

    let cancelled = false
    view.dispatch({ effects: languageCompartment.reconfigure([]) })
    if (!mode) return

    const descriptionName = CODEMIRROR_LANGUAGE_NAMES[mode]
    const description = languages.find((candidate) => candidate.name === descriptionName)
    if (!description) return

    void description.load().then((support) => {
      if (cancelled || viewRef.current !== view) return
      view.dispatch({ effects: languageCompartment.reconfigure(support) })
    }).catch(() => {
      if (cancelled || viewRef.current !== view) return
      view.dispatch({ effects: languageCompartment.reconfigure([]) })
    })

    return () => {
      cancelled = true
    }
  }, [mode])

  return (
    <div
      id={id}
      ref={hostRef}
      data-language-mode={mode || "text"}
      className={cn(
        "overflow-hidden rounded-xl border border-transparent bg-muted/45 outline-none ring-1 ring-foreground/[0.075] focus-within:ring-2 focus-within:ring-ring/45 dark:bg-input/30",
        className,
      )}
    />
  )
}
