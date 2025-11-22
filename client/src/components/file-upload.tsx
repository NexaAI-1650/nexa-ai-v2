import { useRef, ChangeEvent, useMemo } from "react";
import { Paperclip, Image, File, X, FileText, FileAudio, FileVideo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FileAttachment {
  type: "image" | "file";
  url: string;
  name: string;
  mimeType?: string;
  size?: number;
}

interface FileUploadProps {
  attachments: FileAttachment[];
  onAttachmentsChange: (attachments: FileAttachment[]) => void;
  disabled?: boolean;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

function getFileIcon(mimeType?: string, name?: string) {
  if (!mimeType) return <File className="h-4 w-4" />;
  
  if (mimeType.startsWith("image/")) return <Image className="h-4 w-4" />;
  if (mimeType.startsWith("audio/")) return <FileAudio className="h-4 w-4" />;
  if (mimeType.startsWith("video/")) return <FileVideo className="h-4 w-4" />;
  if (
    mimeType.includes("pdf") ||
    mimeType.includes("word") ||
    mimeType.includes("text") ||
    name?.endsWith(".pdf") ||
    name?.endsWith(".doc") ||
    name?.endsWith(".docx") ||
    name?.endsWith(".txt")
  ) {
    return <FileText className="h-4 w-4" />;
  }
  
  return <File className="h-4 w-4" />;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + "B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + "KB";
  return (bytes / (1024 * 1024)).toFixed(1) + "MB";
}

export function FileUpload({
  attachments,
  onAttachmentsChange,
  disabled,
}: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: FileAttachment[] = [];
    let processedCount = 0;

    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        console.warn(`File ${file.name} exceeds max size (50MB)`);
        processedCount++;
        continue;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const isImage = file.type.startsWith("image/");
        
        newAttachments.push({
          type: isImage ? "image" : "file",
          url: result,
          name: file.name,
          mimeType: file.type,
          size: file.size,
        });

        processedCount++;
        if (processedCount === Array.from(files).length) {
          onAttachmentsChange([...attachments, ...newAttachments]);
        }
      };
      
      reader.onerror = () => {
        processedCount++;
      };
      
      reader.readAsDataURL(file);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    onAttachmentsChange(attachments.filter((_, i) => i !== index));
  };

  const imageAttachments = useMemo(
    () => attachments.filter((a) => a.type === "image"),
    [attachments]
  );
  const fileAttachments = useMemo(
    () => attachments.filter((a) => a.type === "file"),
    [attachments]
  );

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
      />

      {/* Images Preview */}
      {imageAttachments.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {imageAttachments.map((attachment, index) => (
            <div
              key={`${attachment.name}-${index}`}
              className="relative group border rounded-md overflow-hidden animate-slide-in-bottom"
              data-testid={`attachment-image-${index}`}
            >
              <img
                src={attachment.url}
                alt={attachment.name}
                className="h-20 w-20 object-cover"
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removeAttachment(attachments.indexOf(attachment))}
                data-testid={`button-remove-image-${index}`}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Files Preview */}
      {fileAttachments.length > 0 && (
        <div className="space-y-1">
          {fileAttachments.map((attachment, index) => (
            <div
              key={`${attachment.name}-${index}`}
              className="flex items-center gap-2 p-2 bg-card border rounded-md group hover:bg-muted/50 transition-colors animate-slide-in-bottom"
              data-testid={`attachment-file-${index}`}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {getFileIcon(attachment.mimeType, attachment.name)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-foreground">
                    {attachment.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(attachment.size)}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                onClick={() => removeAttachment(attachments.indexOf(attachment))}
                data-testid={`button-remove-file-${index}`}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        data-testid="button-upload-file"
        className="hover-elevate transition-transform duration-200"
        title="ファイルを添付（画像、PDF、Wordなど対応）"
      >
        <Paperclip className="h-4 w-4" />
        <span className="sr-only">ファイルを添付</span>
      </Button>
    </div>
  );
}
