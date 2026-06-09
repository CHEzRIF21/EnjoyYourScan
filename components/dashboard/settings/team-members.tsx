"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  inviteMemberAction,
  removeMemberAction,
} from "@/app/(dashboard)/dashboard/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export interface Member {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  profiles: { full_name: string | null; email: string | null } | null;
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  waiter: "Serveur",
  kitchen: "Cuisine",
};

const ROLE_VARIANTS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  owner: "default",
  manager: "secondary",
  waiter: "outline",
  kitchen: "outline",
};

function InviteSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="shrink-0">
      {pending ? "Envoi…" : "Inviter"}
    </Button>
  );
}

function RemoveSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="destructive"
      size="sm"
      disabled={pending}
    >
      {pending ? "…" : "Retirer"}
    </Button>
  );
}

function RemoveMemberForm({ member }: { member: Member }) {
  const [state, formAction] = useFormState(removeMemberAction, {});

  return (
    <form action={formAction} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="membership_id" value={member.id} />
      <input type="hidden" name="user_id" value={member.user_id} />
      <input type="hidden" name="role" value={member.role} />
      <RemoveSubmitButton />
      {state.error && (
        <p className="text-xs text-destructive max-w-[180px] text-right">
          {state.error}
        </p>
      )}
    </form>
  );
}

interface TeamMembersProps {
  members: Member[];
  isOwner: boolean;
}

export function TeamMembers({ members, isOwner }: TeamMembersProps) {
  const [inviteState, inviteAction] = useFormState(inviteMemberAction, {});

  return (
    <div className="space-y-6">
      {/* ── Liste des membres ── */}
      <Card>
        <CardHeader>
          <CardTitle>Équipe</CardTitle>
          <CardDescription>
            {members.length} membre{members.length !== 1 ? "s" : ""} dans votre
            restaurant.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {members.map((member, idx) => (
            <div key={member.id}>
              {idx > 0 && <Separator className="my-1" />}
              <div className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {member.profiles?.full_name || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {member.profiles?.email || "—"}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant={ROLE_VARIANTS[member.role] ?? "outline"}>
                    {ROLE_LABELS[member.role] ?? member.role}
                  </Badge>
                  {isOwner && member.role !== "owner" && (
                    <RemoveMemberForm member={member} />
                  )}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── Inviter un membre ── */}
      {isOwner && (
        <>
          <Separator />
          <Card>
            <CardHeader>
              <CardTitle>Inviter un membre</CardTitle>
              <CardDescription>
                Si le compte n&apos;existe pas encore, un email d&apos;invitation
                sera envoyé.
              </CardDescription>
            </CardHeader>
            <form action={inviteAction}>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="invite-email">Adresse email *</Label>
                  <Input
                    id="invite-email"
                    name="email"
                    type="email"
                    required
                    placeholder="employe@email.com"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-role">Rôle *</Label>
                  <Select id="invite-role" name="role" defaultValue="waiter">
                    <option value="manager">Manager</option>
                    <option value="waiter">Serveur</option>
                    <option value="kitchen">Cuisine</option>
                  </Select>
                </div>
              </CardContent>
              <CardFooter className="flex items-center justify-between gap-4">
                {inviteState.error && (
                  <p className="text-sm text-destructive">{inviteState.error}</p>
                )}
                {inviteState.success && (
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">
                    {inviteState.success}
                  </p>
                )}
                {!inviteState.error && !inviteState.success && (
                  <span />
                )}
                <InviteSubmitButton />
              </CardFooter>
            </form>
          </Card>
        </>
      )}
    </div>
  );
}
