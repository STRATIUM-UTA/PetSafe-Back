export type PublicPatientProfileResponse = {
  id: number;
  name: string;
  species: string | null;
  breed: string | null;
  sex: string | null;
  color: string | null;
  birthDate: string | null;
  distinguishingMarks: string | null;
  microchipCode: string | null;
  image: { url: string } | null;
  owner: {
    firstName: string;
    lastName: string;
    fullName: string;
    phone: string | null;
  } | null;
};
