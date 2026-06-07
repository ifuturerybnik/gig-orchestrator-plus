import { useState, useEffect, useRef, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { Plus, Send, Loader2, MessageCircle, Archive, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const MAX_ATTACHMENTS = 3;
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIMES = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"];

type PendingAttachment = {
  name: string;
  mimeType: string;
  size: number;
  dataBase64: string;
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // wycinamy prefix data:...;base64,
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
import {
  listAssistantThreads,
  createAssistantThread,
  archiveAssistantThread,
  listAssistantMessages,
  sendAssistantMessage,
  type AssistantThread,
  type AssistantMessage,
} from "@/lib/assistant.functions";

interface AssistantPanelProps {
  orgId: string;
}

export function AssistantPanel({ orgId }: AssistantPanelProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchThreads = useServerFn(listAssistantThreads);
  const fetchMessages = useServerFn(listAssistantMessages);
  const createThread = useServerFn(createAssistantThread);
  const archiveThread = useServerFn(archiveAssistantThread);
  const sendMessage = useServerFn(sendAssistantMessage);

  const threadsQuery = useQuery({
    queryKey: ["assistant-threads", orgId],
    queryFn: () => fetchThreads({ data: { orgId } }),
  });

  const threads = (threadsQuery.data ?? []) as AssistantThread[];

  // auto-select most recent thread
  useEffect(() => {
    if (!activeId && threads.length > 0) setActiveId(threads[0].id);
  }, [threads, activeId]);

  const messagesQuery = useQuery({
    queryKey: ["assistant-messages", activeId],
    queryFn: () =>
      activeId ? fetchMessages({ data: { threadId: activeId } }) : Promise.resolve([]),
    enabled: !!activeId,
  });
  const messages = (messagesQuery.data ?? []) as AssistantMessage[];

  const createMutation = useMutation({
    mutationFn: () => createThread({ data: { orgId } }),
    onSuccess: (data) => {
      setActiveId(data.id);
      qc.invalidateQueries({ queryKey: ["assistant-threads", orgId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const archiveMutation = useMutation({
    mutationFn: (threadId: string) => archiveThread({ data: { threadId } }),
    onSuccess: () => {
      setActiveId(null);
      qc.invalidateQueries({ queryKey: ["assistant-threads", orgId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const sendMutation = useMutation({
    mutationFn: async (vars: { content: string; attachments: PendingAttachment[] }) => {
      let threadId = activeId;
      if (!threadId) {
        const { id } = await createThread({ data: { orgId } });
        threadId = id;
        setActiveId(id);
        qc.invalidateQueries({ queryKey: ["assistant-threads", orgId] });
      }
      const summary = vars.attachments.length
        ? `\n\n📎 ${vars.attachments.map((a) => a.name).join(", ")}`
        : "";
      // optimistic: dodaj usera od razu
      qc.setQueryData<AssistantMessage[]>(
        ["assistant-messages", threadId],
        (prev) => [
          ...(prev ?? []),
          {
            id: `tmp-${Date.now()}`,
            role: "user",
            content: vars.content + summary,
            created_at: new Date().toISOString(),
            cost_usd: 0,
          },
        ],
      );
      return sendMessage({
        data: {
          threadId,
          content: vars.content,
          attachments: vars.attachments.map((a) => ({
            name: a.name,
            mimeType: a.mimeType,
            dataBase64: a.dataBase64,
          })),
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assistant-messages", activeId] });
      qc.invalidateQueries({ queryKey: ["assistant-threads", orgId] });
    },
    onError: (err: Error) => {
      toast.error(t("organizations.assistant.error", { msg: err.message }));
      qc.invalidateQueries({ queryKey: ["assistant-messages", activeId] });
    },
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, sendMutation.isPending]);

  async function onPickFiles(files: FileList | null) {
    if (!files) return;
    const remaining = MAX_ATTACHMENTS - attachments.length;
    if (remaining <= 0) {
      toast.error(t("organizations.assistant.attach_limit", { max: MAX_ATTACHMENTS }));
      return;
    }
    const picked = Array.from(files).slice(0, remaining);
    const next: PendingAttachment[] = [];
    for (const f of picked) {
      if (!ALLOWED_MIMES.includes(f.type)) {
        toast.error(t("organizations.assistant.attach_bad_type", { name: f.name }));
        continue;
      }
      if (f.size > MAX_BYTES) {
        toast.error(t("organizations.assistant.attach_too_big", { name: f.name }));
        continue;
      }
      const dataBase64 = await fileToBase64(f);
      next.push({ name: f.name, mimeType: f.type, size: f.size, dataBase64 });
    }
    setAttachments((prev) => [...prev, ...next]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content || sendMutation.isPending) return;
    const atts = attachments;
    setInput("");
    setAttachments([]);
    sendMutation.mutate({ content, attachments: atts });
  }

  return (
    <div className="grid h-[calc(100vh-12rem)] grid-cols-[260px_1fr] gap-4 rounded-lg border bg-card">
      {/* Lista wątków */}
      <aside className="flex flex-col border-r">
        <div className="border-b p-3">
          <Button
            size="sm"
            className="w-full"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("organizations.assistant.new_thread")}
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-1 p-2">
            {threads.length === 0 && !threadsQuery.isLoading ? (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                {t("organizations.assistant.no_threads")}
              </p>
            ) : (
              threads.map((th) => (
                <button
                  key={th.id}
                  onClick={() => setActiveId(th.id)}
                  className={cn(
                    "group flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
                    th.id === activeId
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 truncate">{th.title}</span>
                  <Archive
                    className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-60"
                    onClick={(e) => {
                      e.stopPropagation();
                      archiveMutation.mutate(th.id);
                    }}
                  />
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </aside>

      {/* Czat */}
      <section className="flex min-h-0 flex-col">
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-4">
          {messages.length === 0 && !messagesQuery.isLoading ? (
            <p className="mt-8 text-center text-sm text-muted-foreground">
              {t("organizations.assistant.no_messages")}
            </p>
          ) : (
            <div className="space-y-4">
              {messages
                .filter((m) => m.role === "user" || m.role === "assistant")
                .map((m) => (
                  <MessageBubble key={m.id} message={m} />
                ))}
              {sendMutation.isPending && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("organizations.assistant.thinking")}
                </div>
              )}
            </div>
          )}
        </div>

        <form onSubmit={onSubmit} className="border-t p-3">
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {attachments.map((a, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs"
                >
                  <Paperclip className="h-3 w-3" />
                  <span className="max-w-[180px] truncate">{a.name}</span>
                  <span className="text-muted-foreground">
                    {(a.size / 1024).toFixed(0)} KB
                  </span>
                  <button
                    type="button"
                    className="ml-0.5 text-muted-foreground hover:text-destructive"
                    onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                    aria-label="remove"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              accept={ALLOWED_MIMES.join(",")}
              onChange={(e) => onPickFiles(e.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-[60px] w-10 shrink-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={sendMutation.isPending || attachments.length >= MAX_ATTACHMENTS}
              title={t("organizations.assistant.attach")}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("organizations.assistant.composer_placeholder")}
              rows={2}
              className="min-h-[60px] resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSubmit(e);
                }
              }}
            />
            <Button type="submit" disabled={sendMutation.isPending || !input.trim()}>
              {sendMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          {sendMutation.data && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("organizations.assistant.limit", {
                used: sendMutation.data.monthly_used.toFixed(4),
                limit: sendMutation.data.monthly_limit.toFixed(2),
              })}
            </p>
          )}
        </form>
      </section>
    </div>
  );
}

function MessageBubble({ message }: { message: AssistantMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-4 py-2 text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none break-words">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
