import { memberVars } from "@/lib/palettes";
import { initials } from "@/lib/format";

type AvatarMember = { display_name: string; palette: number } | null | undefined;

export function MemberAvatar({
  member,
  size = 28,
  maxLetters = 2,
}: {
  member: AvatarMember;
  size?: number;
  maxLetters?: number;
}) {
  return (
    <span
      className="initial-circle"
      style={{
        ...memberVars(member?.palette),
        width: size,
        height: size,
        fontSize: Math.max(9, Math.round(size * 0.4)),
      }}
    >
      {member ? initials(member.display_name, maxLetters) : "?"}
    </span>
  );
}
