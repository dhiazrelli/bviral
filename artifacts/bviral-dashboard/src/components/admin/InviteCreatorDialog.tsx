import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { adminApi } from "@/lib/admin-api";

export function InviteCreatorDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const invite = useMutation({
    mutationFn: () => adminApi.inviteCreator({ email: email.trim(), fullName: fullName.trim() }),
    onSuccess: () => {
      toast({
        title: "Invitation sent",
        description: `${email} will receive a magic-link email to set their password.`,
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "creators"] });
      setEmail("");
      setFullName("");
      setOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Invite failed",
        description: error.message ?? "Could not send the invitation.",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" /> Invite creator
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a content creator</DialogTitle>
          <DialogDescription>
            A magic-link email goes to the address you enter. They set their own password on first login.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!email.trim() || !fullName.trim()) return;
            invite.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="invite-fullname">Full name</Label>
            <Input
              id="invite-fullname"
              required
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="off"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={invite.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={invite.isPending}>
              {invite.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Send invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
