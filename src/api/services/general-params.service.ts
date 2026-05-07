import apiClient from "../api-client";

export type DossierGeneralParams = {
  dossierId?: number;
  companyName?: string;
  address?: string;
  legalForm?: string;
  rcNumber?: string;
  ifNumber?: string;
  tsc?: string;
  activity?: string;
  category?: string;
  professionalTax?: string;
  cmRate?: number | null;
  isRate?: number | null;
  ice?: string;
  cniOrResidenceCard?: string;
  legalRepresentative?: string;
  capital?: number | null;
  subjectToRas?: boolean;
  individualPerson?: boolean;
  hasFiscalRegularityCertificate?: boolean;
  allowValidatedDocumentDeletion?: boolean;
  allowAccountedDocumentDeletion?: boolean;
};

function getCurrentDossierId(): number | undefined {
  if (typeof window === "undefined") return undefined;
  const raw = window.localStorage.getItem("currentDossierId");
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : undefined;
}

export class GeneralParamsService {
  static async getParams(dossierIdArg?: number): Promise<DossierGeneralParams> {
    const dossierId = dossierIdArg ?? getCurrentDossierId();
    const response = await apiClient.get<{ params?: DossierGeneralParams }>(
      "/api/settings/general-params",
      { params: { dossierId } },
    );
    return response.data?.params ?? (response.data as unknown as DossierGeneralParams);
  }

  static async saveParams(
    payload: DossierGeneralParams,
    dossierIdArg?: number,
  ): Promise<DossierGeneralParams> {
    const dossierId = dossierIdArg ?? getCurrentDossierId();
    const response = await apiClient.put<{ params?: DossierGeneralParams }>(
      "/api/settings/general-params",
      payload,
      { params: { dossierId } },
    );
    return response.data?.params ?? (response.data as unknown as DossierGeneralParams);
  }
}
