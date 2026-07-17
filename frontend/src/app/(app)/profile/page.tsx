import { Bike, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { auth } from "@/auth";
import { addBikeAction, deleteBikeAction, updateProfileAction } from "@/app/actions";
import { backendFetch } from "@/lib/backend";
import type { UserProfile } from "@/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profile and bikes" };

export default async function ProfilePage() {
  const session = await auth();
  const response = await backendFetch<{ user: UserProfile }>("me", {
    token: session!.accessToken,
  });
  const user = response.user;

  return (
    <div className="app-page profile-page">
      <header className="app-page-header">
        <div>
          <span className="eyebrow">Rider setup</span>
          <h1>Your profile shapes the route.</h1>
          <p>Keep your current form, weekly intention, and bike garage accurate.</p>
        </div>
      </header>

      <div className="profile-grid">
        <section className="content-panel">
          <div className="panel-heading">
            <span className="eyebrow">Account</span>
            <h2>Rider details</h2>
          </div>
          <form action={updateProfileAction} className="stack-form">
            <div className="two-column-fields">
              <label>
                Username
                <input name="username" defaultValue={user.username} required />
              </label>
              <label>
                Email
                <input name="email" type="email" defaultValue={user.email} required />
              </label>
            </div>
            <label>
              Short bio
              <textarea name="bio" defaultValue={user.bio ?? ""} placeholder="What kind of rider are you?" />
            </label>
            <div className="three-column-fields">
              <label>
                Fitness
                <select name="fitness_level" defaultValue={user.fitness_level}>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </label>
              <label>
                Weekly goal
                <span className="input-with-unit">
                  <input name="weekly_distance_goal" type="number" min="10" max="1000" defaultValue={user.weekly_distance_goal} />
                  <span>km</span>
                </span>
              </label>
              <label>
                Preferred ride
                <span className="input-with-unit">
                  <input name="preferred_distance" type="number" min="5" max="300" defaultValue={user.preferred_distance} />
                  <span>km</span>
                </span>
              </label>
            </div>
            <button className="button button-dark">Save profile</button>
          </form>
        </section>

        <aside className="profile-summary">
          <span className="profile-avatar">{user.username.slice(0, 2).toUpperCase()}</span>
          <span className="eyebrow">CycleLine rider</span>
          <h2>{user.username}</h2>
          <p>{user.bio || "No rider bio yet."}</p>
          <dl>
            <div>
              <dt>Fitness</dt>
              <dd>{user.fitness_level}</dd>
            </div>
            <div>
              <dt>Routes</dt>
              <dd>{user.routes_count}</dd>
            </div>
            <div>
              <dt>Bikes</dt>
              <dd>{user.bikes.length}</dd>
            </div>
          </dl>
        </aside>
      </div>

      <section className="garage-section">
        <div className="panel-heading-row">
          <div>
            <span className="eyebrow">Your garage</span>
            <h2>Choose the bike before the line.</h2>
          </div>
          <span className="target-pill">
            <Bike size={15} /> {user.bikes.length} {user.bikes.length === 1 ? "bike" : "bikes"}
          </span>
        </div>

        <div className="garage-grid">
          <div className="bike-list">
            {user.bikes.map((bike) => (
              <article key={bike.id} className="bike-card">
                <span className="bike-card-icon">
                  <Bike size={25} />
                </span>
                <div>
                  <span>{bike.type}</span>
                  <h3>{bike.name}</h3>
                  <p>{bike.notes || "Ready for the next route."}</p>
                  <small>{bike.weight_kg ? `${bike.weight_kg} kg` : "Weight not set"}</small>
                </div>
                <div className="bike-card-end">
                  {bike.is_default && (
                    <span className="default-pill">
                      <CheckCircle2 size={14} /> Default
                    </span>
                  )}
                  <form action={deleteBikeAction}>
                    <input type="hidden" name="bike_id" value={bike.id} />
                    <button className="icon-button danger" aria-label={`Remove ${bike.name}`}>
                      <Trash2 size={16} />
                    </button>
                  </form>
                </div>
              </article>
            ))}
            {!user.bikes.length && (
              <div className="empty-state compact">
                <Bike size={24} />
                <h3>Your garage is empty.</h3>
                <p>Add a bike so the planner can choose a matching route profile.</p>
              </div>
            )}
          </div>

          <form action={addBikeAction} className="content-panel stack-form add-bike-form">
            <div className="panel-heading">
              <span className="eyebrow">New bike</span>
              <h3>Add to garage</h3>
            </div>
            <label>
              Bike name
              <input name="name" placeholder="e.g. Moss" required minLength={2} />
            </label>
            <div className="two-column-fields">
              <label>
                Type
                <select name="type" defaultValue="gravel">
                  <option value="road">Road</option>
                  <option value="gravel">Gravel</option>
                  <option value="mountain">Mountain</option>
                  <option value="city">City</option>
                  <option value="electric">Electric</option>
                  <option value="touring">Touring</option>
                </select>
              </label>
              <label>
                Weight
                <span className="input-with-unit">
                  <input name="weight_kg" type="number" min="3" max="40" step="0.1" placeholder="9.4" />
                  <span>kg</span>
                </span>
              </label>
            </div>
            <label>
              Notes
              <textarea name="notes" placeholder="Tyres, setup, or the kind of ride it loves." />
            </label>
            <label className="check-label">
              <input type="checkbox" name="is_default" />
              <span>Use as my default bike</span>
            </label>
            <button className="button button-acid">
              <Plus size={17} /> Add bike
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
