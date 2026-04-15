/* ═══════════════════════════════════════════════════════
   AdminCreateParcel — Register a new land parcel
   ═══════════════════════════════════════════════════════ */

import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useToast } from "../context/ToastContext";
import CnicInput from "../components/CnicInput";

export default function AdminCreateParcel() {
  const [district, setDistrict] = useState("");
  const [moza, setMoza] = useState("");
  const [plotNumber, setPlotNumber] = useState("");
  const [khasra, setKhasra] = useState("");
  const [ownerCnic, setOwnerCnic] = useState("");
  const [disputed, setDisputed] = useState(false);
  const [fardText, setFardText] = useState("");
  const [registryText, setRegistryText] = useState("");
  const [mutationText, setMutationText] = useState("");
  const [loading, setLoading] = useState(false);

  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (ownerCnic.length !== 13) {
      showToast("Owner CNIC must be 13 digits", "error");
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        district: district.trim(),
        moza: moza.trim(),
        plotNumber: plotNumber.trim(),
        currentOwnerCnic: ownerCnic,
        disputed,
      };
      if (khasra.trim()) body.khasra = khasra.trim();
      if (fardText.trim()) body.fardText = fardText.trim();
      if (registryText.trim()) body.registryText = registryText.trim();
      if (mutationText.trim()) body.mutationText = mutationText.trim();

      const data = await api.post<{ parcel: { id: string } }>(
        "/admin/parcels",
        body
      );
      showToast("Parcel registered successfully!", "success");
      navigate(`/parcels/${data.parcel.id}`);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "Failed to create parcel",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-page">
      <div className="page-header">
        <h1>
          Register <span className="gradient-text">New Parcel</span>
        </h1>
        <p>Add a new land parcel to the registry</p>
      </div>

      <form onSubmit={handleSubmit} className="form-card glass-card">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="parcel-district">District *</label>
            <input
              type="text"
              id="parcel-district"
              className="form-input"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              placeholder="e.g. Lahore"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="parcel-moza">Moza *</label>
            <input
              type="text"
              id="parcel-moza"
              className="form-input"
              value={moza}
              onChange={(e) => setMoza(e.target.value)}
              placeholder="e.g. Ravi"
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="parcel-plot">Plot Number *</label>
            <input
              type="text"
              id="parcel-plot"
              className="form-input"
              value={plotNumber}
              onChange={(e) => setPlotNumber(e.target.value)}
              placeholder="e.g. P-42"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="parcel-khasra">
              Khasra <span className="form-optional">(optional)</span>
            </label>
            <input
              type="text"
              id="parcel-khasra"
              className="form-input"
              value={khasra}
              onChange={(e) => setKhasra(e.target.value)}
              placeholder="Khasra number"
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="parcel-owner">Current Owner CNIC *</label>
          <CnicInput
            value={ownerCnic}
            onChange={setOwnerCnic}
            id="parcel-owner"
            required
          />
        </div>

        <div className="form-group form-group--checkbox">
          <label>
            <input
              type="checkbox"
              checked={disputed}
              onChange={(e) => setDisputed(e.target.checked)}
            />
            <span>Mark as disputed</span>
          </label>
        </div>

        <div className="form-group">
          <label htmlFor="parcel-fard">
            Fard Text <span className="form-optional">(optional)</span>
          </label>
          <textarea
            id="parcel-fard"
            className="form-input form-textarea"
            value={fardText}
            onChange={(e) => setFardText(e.target.value)}
            placeholder="Paste fard document text…"
            rows={4}
          />
        </div>

        <div className="form-group">
          <label htmlFor="parcel-registry">
            Registry Text <span className="form-optional">(optional)</span>
          </label>
          <textarea
            id="parcel-registry"
            className="form-input form-textarea"
            value={registryText}
            onChange={(e) => setRegistryText(e.target.value)}
            placeholder="Paste registry document text…"
            rows={4}
          />
        </div>

        <div className="form-group">
          <label htmlFor="parcel-mutation">
            Mutation Text <span className="form-optional">(optional)</span>
          </label>
          <textarea
            id="parcel-mutation"
            className="form-input form-textarea"
            value={mutationText}
            onChange={(e) => setMutationText(e.target.value)}
            placeholder="Paste mutation document text…"
            rows={4}
          />
        </div>

        <button
          type="submit"
          className="btn btn--primary btn--full"
          disabled={loading}
        >
          {loading ? "Registering…" : "Register Parcel"}
        </button>
      </form>
    </div>
  );
}
