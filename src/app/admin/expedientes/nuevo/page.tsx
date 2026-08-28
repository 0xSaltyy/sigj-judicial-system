import { AdminPageHeader } from "@/components/admin-page";
import { FederalRecordForm } from "@/components/federal-record-form";
import { createClient } from "@/lib/supabase/server";
import { fallbackFederalCourts, fallbackNatureOfSuit, type CourtDivisionOption, type FederalCourtOption, type NatureOfSuitOption } from "@/lib/federal-model";

export const metadata = { title: "Abrir Matter o Case" };

type CourtRow = {
  id: string;
  court_system: string;
  court_level: string;
  official_name: string;
  abbreviation: string;
  circuit: string | null;
  district: string | null;
  state_or_territory: string | null;
  accepted_case_categories: string[] | null;
};

type NatureRow = {
  code: string;
  official_label: string;
  display_label_es: string;
  category: string;
};

type DivisionRow = {
  id: string;
  court_id: string;
  name: string;
  city: string | null;
  courthouse_name: string | null;
  clerk_office: string | null;
};

export default async function NewFederalRecordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const query = await searchParams;
  const supabase = await createClient();
  const [courtsResult, divisionsResult, natureResult] = supabase ? await Promise.all([
    supabase.from("federal_courts").select("id,court_system,court_level,official_name,abbreviation,circuit,district,state_or_territory,accepted_case_categories").eq("active", true).order("court_level").order("official_name"),
    supabase.from("court_divisions").select("id,court_id,name,city,courthouse_name,clerk_office").eq("active", true).order("name"),
    supabase.from("nature_of_suit_catalog").select("code,official_label,display_label_es,category").eq("active", true).order("sort_order"),
  ]) : [{ data: null }, { data: null }, { data: null }];

  const courts = ((courtsResult.data ?? []) as CourtRow[]).map((court): FederalCourtOption => ({
    id: court.id,
    courtSystem: court.court_system,
    courtLevel: court.court_level,
    officialName: court.official_name,
    abbreviation: court.abbreviation,
    circuit: court.circuit,
    district: court.district,
    stateOrTerritory: court.state_or_territory,
    acceptedCaseCategories: (court.accepted_case_categories ?? []) as FederalCourtOption["acceptedCaseCategories"],
  }));
  const natureOfSuit = ((natureResult.data ?? []) as NatureRow[]).map((item): NatureOfSuitOption => ({
    code: item.code,
    officialLabel: item.official_label,
    displayLabelEs: item.display_label_es,
    category: item.category,
  }));
  const divisions = ((divisionsResult.data ?? []) as DivisionRow[]).map((division): CourtDivisionOption => ({
    id: division.id,
    courtId: division.court_id,
    name: division.name,
    city: division.city,
    courthouseName: division.courthouse_name,
    clerkOffice: division.clerk_office,
  }));

  return (
    <>
      <AdminPageHeader
        title="Abrir Matter o Case federal"
        description="Seleccione primero si el registro pertenece al trabajo interno del DOJ o a un procedimiento presentado ante un tribunal federal. El servidor genera Matter Number o Case Number y mantiene separado el Docket Number."
      />
      <FederalRecordForm
        courts={courts.length ? courts : fallbackFederalCourts}
        divisions={divisions}
        natureOfSuit={natureOfSuit.length ? natureOfSuit : fallbackNatureOfSuit}
        error={query.error}
      />
    </>
  );
}
