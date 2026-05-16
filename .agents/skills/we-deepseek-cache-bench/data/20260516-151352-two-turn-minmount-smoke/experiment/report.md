# DeepSeek Guided Cache Benchmark

- model: deepseek-v4-pro
- modelProvider: deepseek
- threadId: 019e2fa3-65fc-7381-a85d-304bffcc8f7b
- workspace: /bench/20260516-151352-two-turn-minmount-smoke/workspace
- preview port: 5173
- first-party lines: 2133
- first-party files: 10

| turn | name | status | effort | context | requests | seconds | input | cached | miss | hit rate |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | initial-product-slice | completed | high | 364800 | 34 | 871.025 | 893781 | 879872 | 13909 | 98.4438% |
| 2 | final-smoke-polish | completed | high | 364800 | 46 | 933.279 | 2899542 | 2877568 | 21974 | 99.2422% |
