"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/design-system/components/ui/alert-dialog";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteBoard, renameBoard } from "@/app/actions/boards";

interface BoardMenuProperties {
  readonly boardId: number;
  readonly boardName: string;
  readonly cardCount: number;
}

export const BoardMenu = ({
  boardId,
  boardName,
  cardCount,
}: BoardMenuProperties) => {
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pending, startTransition] = useTransition();

  const rename = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name") ?? "");

    startTransition(async () => {
      const result = await renameBoard(boardId, name);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      setRenaming(false);
    });
  };

  const remove = () => {
    startTransition(async () => {
      const result = await deleteBoard(boardId);

      if (result && "error" in result) {
        toast.error(result.error);
      }
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button aria-label="Opciones del tablero" size="icon" variant="ghost">
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setRenaming(true)}>
            <PencilIcon />
            Renombrar
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive"
            onSelect={() => setDeleting(true)}
          >
            <Trash2Icon />
            Eliminar tablero
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog onOpenChange={setRenaming} open={renaming}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black font-mono uppercase tracking-wider">
              Renombrar tablero
            </DialogTitle>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={rename}>
            <div className="grid gap-2">
              <Label htmlFor="board-rename">Nombre</Label>
              <Input
                autoFocus
                defaultValue={boardName}
                id="board-rename"
                maxLength={80}
                name="name"
                required
              />
            </div>
            <Button disabled={pending} type="submit">
              Guardar
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog onOpenChange={setDeleting} open={deleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar «{boardName}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrarán sus etapas y {cardCount} tarjeta(s) con su historial.
              Los clientes se conservan. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={pending} onClick={remove}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
