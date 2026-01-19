# TRASIM - Supabase Setup Guide

## ✅ Local Supabase Instance Created!

Your TRASIM project now has a fully configured local Supabase instance running in Docker.

---

## 🎯 Quick Access

### Supabase Studio (Database UI)
**URL**: http://127.0.0.1:54343

Use this to:
- View and edit database tables
- Run SQL queries
- Monitor database performance
- Manage authentication (if needed)

### Database Connection
**Connection String**: `postgresql://postgres:postgres@127.0.0.1:54342/postgres`

This is already configured in your `.env` file.

### API Endpoints
- **REST API**: http://127.0.0.1:54341
- **GraphQL**: http://127.0.0.1:54341/graphql/v1
- **Storage**: http://127.0.0.1:54341/storage/v1/s3

### Email Testing (Inbucket)
**URL**: http://127.0.0.1:54344

View emails sent by your app during development.

---

## 📊 Database Schema

Your database migration has been automatically applied! The following tables are ready:

✅ **markets** - Trading markets with bonding curve parameters
✅ **trades** - All buy/sell transactions
✅ **market_snapshots** - Historical market data for charts
✅ **seasons** - Competitive cycles and leaderboards
✅ **reward_claims** - Season reward distribution
✅ **admin_actions** - Audit log for admin operations

---

## 🔑 API Keys

### Anonymous Key (Public)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
```

### Service Role Key (Backend Only - Keep Secret!)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
```

Both keys are already in your `.env` file.

---

## 🚀 Managing Supabase

### Start Supabase
```bash
supabase start
```

### Stop Supabase
```bash
supabase stop
```

### View Status
```bash
supabase status
```

### Reset Database (Caution: Deletes all data!)
```bash
supabase db reset
```

### Create New Migration
```bash
supabase migration new migration_name
```

---

## 📝 Database Migrations

Your initial schema is in: `supabase/migrations/20260119000000_initial_schema.sql`

To add new migrations:
1. Create a new migration file: `supabase migration new add_feature`
2. Edit the generated file in `supabase/migrations/`
3. Apply it: `supabase db reset` (local) or `supabase db push` (remote)

---

## 🌐 Migrating to Cloud Supabase

When you're ready to deploy to production:

### 1. Create Cloud Project
```bash
# Login to Supabase
supabase login

# Link to a new project
supabase link --project-ref your-project-ref
```

### 2. Push Database Schema
```bash
supabase db push
```

### 3. Update Environment Variables
Update your production `.env` with cloud credentials:
```bash
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
SUPABASE_URL=https://[PROJECT-REF].supabase.co
SUPABASE_ANON_KEY=[your-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[your-service-role-key]
```

### 4. Migrate Data (if needed)
```bash
# Export from local
supabase db dump -f backup.sql

# Import to cloud
psql [CLOUD_DATABASE_URL] < backup.sql
```

---

## 🔧 Port Configuration

TRASIM uses custom ports to avoid conflicts with other Supabase projects:

| Service | Port |
|---------|------|
| API | 54341 |
| Database | 54342 |
| Studio | 54343 |
| Inbucket | 54344 |

These are configured in `supabase/config.toml`.

---

## 💡 Tips

1. **Studio is your friend**: Use http://127.0.0.1:54343 to explore your database visually
2. **Check logs**: `docker logs supabase_db_TRASIM` to debug database issues
3. **Backup regularly**: `supabase db dump -f backup.sql` before major changes
4. **Use migrations**: Never edit the database directly in production - always use migrations

---

## 🎉 Next Steps

1. ✅ Supabase is running
2. ✅ Database schema is applied
3. ✅ Environment variables are configured

Now you can:
- Start your API: `yarn dev:api`
- Start your indexer: `yarn dev:indexer`
- Start your web app: `yarn dev:web`
- Or all at once: `yarn dev`

---

**Created**: January 19, 2026
**Status**: Ready for development ✅

