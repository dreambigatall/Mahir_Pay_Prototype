import { PageHeader } from "@/components/clinic/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { roleLabel } from "@/lib/nav";
import { staff } from "@/lib/mock-data";

export default function AdminUsersPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Staff"
        description="Role-based accounts for this clinic."
      />
      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-11 text-[12px] font-medium text-fg-secondary">
                Name
              </TableHead>
              <TableHead className="h-11 text-[12px] font-medium text-fg-secondary">
                Role
              </TableHead>
              <TableHead className="h-11 text-[12px] font-medium text-fg-secondary">
                Title
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staff.map((person) => (
              <TableRow key={person.id} className="h-11">
                <TableCell className="font-medium">{person.name}</TableCell>
                <TableCell>
                  <StatusBadge role="info">{roleLabel[person.role]}</StatusBadge>
                </TableCell>
                <TableCell className="text-fg-secondary">
                  {person.title}
                  {person.room ? ` · ${person.room}` : ""}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
