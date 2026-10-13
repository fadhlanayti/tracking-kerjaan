"use client";
import { useState, useEffect, useRef, use } from "react";
import { useSession } from "next-auth/react";
import { Send, ArrowLeft, MessageSquare } from "lucide-react";
import Link from "next/link";
import { FileUpload } from "@/components/file-upload";
import { getSocket } from "@/lib/socket-client";
import { useImageLightbox } from "@/components/image-lightbox";

interface Message {
  id: string;
  content: string;
  attachments: string[];
  sender: { id: string; name: string; avatar: string | null };
  createdAt: string;
}

function formatTime(date: string) {
  return new Date(date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(date: string) {
  const d = new Date(date);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Hari ini";
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Kemarin";
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const senderColors = [
  "#087CF0",
  "#7C3AED",
  "#0E7490",
  "#F97316",
  "#15803D",
  "#DC2626",
];
function getColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return senderColors[Math.abs(h) % senderColors.length];
}

export default function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session } = useSession();
  const { openImage } = useImageLightbox();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/projects/${id}/chat/messages`)
      .then((r) => r.json())
      .then((data) => {
        if (data.messages) setMessages(data.messages);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    const socket = getSocket();
    socket.emit("join:project", { projectId: id });

    socket.on("message:new", (message: Message) => {
      setMessages((prev) =>
        prev.some((m) => m.id === message.id) ? prev : [...prev, message],
      );
    });

    return () => {
      socket.off("message:new");
    };
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;

    const content = input;
    setInput("");

    const res = await fetch(`/api/projects/${id}/chat/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    if (res.ok) {
      const message = await res.json();
      const socket = getSocket();
      socket.emit("message:send", { ...message, projectId: id });
      setMessages((prev) =>
        prev.some((m) => m.id === message.id) ? prev : [...prev, message],
      );
    }
  }

  function handleFileUpload(urls: string[]) {
    fetch(`/api/projects/${id}/chat/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Shared files", attachments: urls }),
    })
      .then((r) => r.json())
      .then((message) => {
        const socket = getSocket();
        socket.emit("message:send", { ...message, projectId: id });
        setMessages((prev) =>
          prev.some((m) => m.id === message.id) ? prev : [...prev, message],
        );
      });
  }

  if (loading)
    return <div className="loading-state !text-black font-semibold">Loading...</div>;

  // Group messages by date
  let lastDate = "";

  return (
    <div
      className="flex flex-col mx-auto w-full max-w-4xl"
      style={{ height: "calc(100vh - var(--topbar-height) - 2.5rem)" }}
    >
      {/* Chat header */}
      <div
        className="flex items-center gap-3"
        style={{ marginBottom: "1rem", marginTop: "0.5rem" }}
      >
        <Link
          href={`/projects/${id}`}
          style={{
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
          }}
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-2">
          <div
            className="icon-bg-teal"
            style={{
              width: "2rem",
              height: "2rem",
              borderRadius: "0.625rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MessageSquare size={14} color="#0E7490" />
          </div>
          <h2
            className="text-sm font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            Project Chat
          </h2>
        </div>
      </div>

      {/* Messages area */}
      <div
        className="card flex-1 overflow-y-auto"
        style={{ padding: "1rem", marginBottom: "0.75rem" }}
      >
        {messages.length === 0 && (
          <div className="empty-state" style={{ minHeight: "8rem" }}>
            <MessageSquare
              size={28}
              style={{ color: "var(--border)", marginBottom: "0.5rem" }}
            />
            <p>Belum ada pesan</p>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isMe = msg.sender.id === session?.user?.id;
          const msgDate = formatDate(msg.createdAt);
          const showDate = msgDate !== lastDate;
          lastDate = msgDate;

          // Show sender name if prev message is from different person
          const prevMsg = idx > 0 ? messages[idx - 1] : null;
          const showSender =
            !isMe &&
            (!prevMsg || prevMsg.sender.id !== msg.sender.id || showDate);
          const color = getColor(msg.sender.name);

          return (
            <div key={msg.id}>
              {showDate && (
                <div style={{ textAlign: "center", margin: "1rem 0 0.75rem" }}>
                  <span
                    className="text-xs font-medium"
                    style={{
                      color: "var(--text-muted)",
                      backgroundColor: "var(--bg-elevated)",
                      padding: "0.25rem 0.75rem",
                      borderRadius: "1rem",
                    }}
                  >
                    {msgDate}
                  </span>
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: isMe ? "flex-end" : "flex-start",
                  marginBottom: "0.25rem",
                  marginTop: showSender ? "0.5rem" : 0,
                }}
              >
                <div style={{ maxWidth: "75%" }}>
                  {showSender && (
                    <p
                      className="text-xs font-semibold"
                      style={{ color, marginBottom: "0.25rem" }}
                    >
                      {msg.sender.name}
                    </p>
                  )}

                  <div
                    className={isMe ? "chat-bubble-mine" : "chat-bubble-other"}
                  >
                    {msg.content}
                    {msg.attachments?.length > 0 && (
                      <div style={{ marginTop: "0.375rem" }}>
                        {msg.attachments.map((url, i) => {
                          const isImg =
                            url.startsWith("blob:") ||
                            url.startsWith("data:image/") ||
                            /\.(jpg|jpeg|png|gif|webp|svg|avif)$/i.test(
                              url.split("?")[0],
                            ) ||
                            url.startsWith("/uploads/");
                          if (isImg) {
                            return (
                              <button
                                key={i}
                                type="button"
                                onClick={() => openImage(url)}
                                style={{
                                  display: "block",
                                  marginTop: "0.25rem",
                                  background: "transparent",
                                  border: "none",
                                  padding: 0,
                                  cursor: "pointer",
                                  textAlign: "left",
                                }}
                              >
                                <img
                                  src={url}
                                  alt="attachment"
                                  style={{
                                    maxWidth: "14rem",
                                    width: "100%",
                                    borderRadius: "0.5rem",
                                    display: "block",
                                  }}
                                />
                              </button>
                            );
                          }
                          return (
                            <a
                              key={i}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs underline"
                              style={{
                                color: isMe
                                  ? "rgba(255,255,255,0.8)"
                                  : "var(--accent)",
                                display: "block",
                                marginTop: "0.25rem",
                              }}
                            >
                              File {i + 1}
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <p
                    className="text-xs"
                    style={{
                      color: "var(--text-muted)",
                      marginTop: "0.125rem",
                      textAlign: isMe ? "right" : "left",
                      fontSize: "0.625rem",
                    }}
                  >
                    {formatTime(msg.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input bar - ChatGPT style */}
      <form
        onSubmit={sendMessage}
        className="flex items-center gap-3 p-2 bg-white rounded-3xl border border-slate-200 shadow-md focus-within:border-slate-400 focus-within:shadow-lg transition-all"
        style={{ marginTop: "0.5rem" }}
      >
        <div className="pl-1">
          <FileUpload onUpload={handleFileUpload} />
        </div>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Kirim pesan atau instruksi..."
          className="flex-1 bg-transparent border-none text-sm outline-none px-2 py-1 text-slate-800 placeholder:text-slate-400"
          style={{ boxShadow: "none" }}
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-all border-none cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            backgroundColor: input.trim() ? "#F97316" : "#E2E8F0",
            color: "white",
          }}
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
