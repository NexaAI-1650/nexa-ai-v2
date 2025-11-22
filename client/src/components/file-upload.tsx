import { useRef, ChangeEvent } from "react";
import { Image, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FileAttachment {
  type: "image";
  url: string;
  name: string;
}

interface FileUploadProps {
  attachments: FileAttachment[];
  onAttachmentsChange: (attachments: FileAttachment[]) => void;
  disabled?: boolean;
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

    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        continue;
      }

      // Convert to base64
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        newAttachments.push({
          type: "image",
          url: result,
          name: file.name,
        });

        if (newAttachments.length === files.length) {
          onAttachmentsChange([...attachments, ...newAttachments]);
        }
      };
      reader.readAsDataURL(file);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    onAttachmentsChange(attachments.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
      />

      {attachments.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {attachments.map((attachment, index) => (
            <div
              key={index}
              className="relative group border rounded-md overflow-hidden"
              data-testid={`attachment-${index}`}
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
                onClick={() => removeAttachment(index)}
                data-testid={`button-remove-attachment-${index}`}
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
      >
        <Image className="h-4 w-4" />
        <span className="sr-only">画像を添付</span>
      </Button>
    </div>
  );
}
