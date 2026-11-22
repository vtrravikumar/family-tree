ALTER TABLE families
  ADD COLUMN is_sample INTEGER NOT NULL DEFAULT 0 CHECK (is_sample IN (0, 1));

CREATE UNIQUE INDEX one_canonical_sample_family ON families(is_sample) WHERE is_sample = 1;

CREATE TABLE sample_family_dismissals (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  dismissed_at TEXT NOT NULL
);

-- This non-login system owner keeps the fictional shared sample independent of any person's account.
INSERT OR IGNORE INTO users(id,identity_provider,provider_subject,email,display_name,created_at,updated_at)
VALUES('sample-owner','system','vansvriksh-sample-owner','sample-owner@vansvriksh.invalid','Vansvriksh Sample',strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'));

INSERT OR IGNORE INTO families(id,name,owner_user_id,privacy,created_at,updated_at,is_sample)
VALUES('sample-family-v1','Vansvriksh Sample Family','sample-owner','private',strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'),1);

INSERT OR IGNORE INTO family_members(family_id,user_id,role,joined_at)
VALUES('sample-family-v1','sample-owner','owner',strftime('%Y-%m-%dT%H:%M:%fZ','now'));

INSERT OR IGNORE INTO persons(id,family_id,given_name,family_name,display_name,gender,birth_date_kind,birth_year,created_at,updated_at)
VALUES
 ('sample-person-kamala','sample-family-v1','Kamala','Iyer','Kamala Iyer','female','approximate_year',1940,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('sample-person-dev','sample-family-v1','Dev','Iyer','Dev Iyer','male','year',1938,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('sample-person-meera','sample-family-v1','Meera','Iyer','Meera Iyer','female','year',1965,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('sample-person-arun','sample-family-v1','Arun','Menon','Arun Menon','male','approximate_year',1963,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('sample-person-kiran','sample-family-v1','Kiran','Rao','Kiran Rao','unspecified','year',1966,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('sample-person-tara','sample-family-v1','Tara','Menon','Tara Menon','female','year',1990,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('sample-person-rohan','sample-family-v1','Rohan','Menon','Rohan Menon','male','approximate_year',1993,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('sample-person-leela','sample-family-v1','Leela','Menon','Leela Menon','female','year',2018,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'));

INSERT OR IGNORE INTO relationships(id,family_id,from_person_id,to_person_id,relationship_type,created_at)
VALUES
 ('sample-rel-01','sample-family-v1','sample-person-kamala','sample-person-dev','spouse',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('sample-rel-02','sample-family-v1','sample-person-kamala','sample-person-meera','biological_parent',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('sample-rel-03','sample-family-v1','sample-person-dev','sample-person-meera','biological_parent',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('sample-rel-04','sample-family-v1','sample-person-meera','sample-person-arun','partner',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('sample-rel-05','sample-family-v1','sample-person-meera','sample-person-tara','biological_parent',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('sample-rel-06','sample-family-v1','sample-person-arun','sample-person-tara','biological_parent',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('sample-rel-07','sample-family-v1','sample-person-meera','sample-person-rohan','biological_parent',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('sample-rel-08','sample-family-v1','sample-person-arun','sample-person-rohan','biological_parent',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('sample-rel-09','sample-family-v1','sample-person-arun','sample-person-kiran','spouse',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('sample-rel-10','sample-family-v1','sample-person-kiran','sample-person-tara','step_parent',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('sample-rel-11','sample-family-v1','sample-person-tara','sample-person-rohan','sibling',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('sample-rel-12','sample-family-v1','sample-person-tara','sample-person-leela','adoptive_parent',strftime('%Y-%m-%dT%H:%M:%fZ','now'));

-- Grant the sample to accounts already registered in this database; newly authenticated users are added by the API.
INSERT OR IGNORE INTO family_members(family_id,user_id,role,joined_at)
SELECT 'sample-family-v1',u.id,'viewer',strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM users u
WHERE u.id<>'sample-owner'
  AND NOT EXISTS (SELECT 1 FROM sample_family_dismissals d WHERE d.user_id=u.id);
