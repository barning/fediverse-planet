// This file imports only the sanitized, generated publication dataset, never raw state.
import publication from '../../data/public.json';
import { stateSchema, sourceSchema, preferencesSchema } from './model.js';
export const state = stateSchema.parse(publication.state);
export const sources = sourceSchema.array().parse(publication.sources);
export const preferences = preferencesSchema.parse(publication.preferences);
export const posts = state.posts;

export const rankings = publication.rankings;
