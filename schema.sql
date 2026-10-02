CREATE TABLE IF NOT EXISTS jobs (
    id serial primary key,
    type varchar(150),
    payload JSONB,
    status varchar(30) default 'pending',
    attempts int default 0,
    max_attempts int default 4,
    run_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);