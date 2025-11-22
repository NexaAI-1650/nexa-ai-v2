import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { aiModels, type AIModel } from "@shared/schema";

interface ModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function ModelSelector({ value, onChange, disabled }: ModelSelectorProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-[280px]" data-testid="select-model">
        <SelectValue placeholder="AIモデルを選択" />
      </SelectTrigger>
      <SelectContent>
        {aiModels.map((model) => (
          <SelectItem
            key={model.id}
            value={model.id}
            data-testid={`option-model-${model.id}`}
          >
            {model.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
