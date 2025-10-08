# Utility Scripts
![image](https://img.shields.io/badge/Liquibase-2962FF.svg?style=plastic&logo=liquibase&logoColor=white)
![image](https://img.shields.io/badge/Bash-4EAA25.svg?style=plastic&logo=gnubash&logoColor=white)

<!-- TOC -->
* [Database](#database)
    * [Liquibase changeset](#liquibase-changeset)
<!-- TOC -->

## Database
### Liquibase changeset
Generating new migration file for liquibase
```shell
bash scripts/liquibase/new_migration.sh ${module path} ${migration name} ${migration comment}
```

```shell
# Example
bash scripts/liquibase/new_migration.sh api new_migration "no comments"
```

It will create new migration file in modules `resources/db/changelog/scripts` directory.
