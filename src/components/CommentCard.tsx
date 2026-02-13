import { useState } from "react";
import { Copy, Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

export interface Comment {
  nombre: string;
  ciudad: string;
  comentario: string;
}

interface CommentCardProps {
  comment: Comment;
  onUpdate: (updated: Comment) => void;
}

const CommentCard = ({ comment, onUpdate }: CommentCardProps) => {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.comentario);

  const copy = () => {
    navigator.clipboard.writeText(`${comment.nombre} - ${comment.ciudad}\n${comment.comentario}`);
    toast({ title: "Copiado al portapapeles" });
  };

  const save = () => {
    onUpdate({ ...comment, comentario: editText });
    setEditing(false);
  };

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="font-bold text-base">{comment.nombre}</h3>
          <p className="text-xs text-muted-foreground">{comment.ciudad}</p>
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={copy}>
            <Copy className="h-3 w-3" /> Copiar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 text-xs"
            onClick={() => { if (editing) save(); else setEditing(true); }}
          >
            {editing ? <><Check className="h-3 w-3" /> Guardar</> : <><Pencil className="h-3 w-3" /> Editar</>}
          </Button>
        </div>
      </div>
      {editing ? (
        <Textarea
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          className="mt-3 text-sm"
          rows={3}
        />
      ) : (
        <p className="mt-3 text-sm leading-relaxed">{comment.comentario}</p>
      )}
    </div>
  );
};

export default CommentCard;
