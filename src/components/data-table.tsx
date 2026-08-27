import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Column<T> = { key: string; header: string; cell: (row: T) => React.ReactNode };

export function DataTable<T>({
  rows,
  columns,
  getRowId,
}: {
  rows: T[];
  columns: Column<T>[];
  getRowId: (row: T) => string;
}) {
  return (
    <div className="overflow-x-auto border border-[#cfd6dc] bg-[#fffdf8]">
      <Table>
        <TableHeader>
          <TableRow className="border-[#cfd6dc] bg-[#0a2540] hover:bg-[#0a2540]">
            {columns.map((column) => (
              <TableHead key={column.key} className="h-10 text-[11px] font-semibold uppercase tracking-[.12em] text-slate-200">
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={getRowId(row)} className="border-[#dce2e7] hover:bg-[#f7f1e5]">
              {columns.map((column) => (
                <TableCell key={column.key} className="py-3 align-top text-sm">
                  {column.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
